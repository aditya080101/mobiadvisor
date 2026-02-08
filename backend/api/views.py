"""
API views for MobiAdvisor.
"""

import json
import asyncio
from django.http import JsonResponse
from django.views import View
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from openai import OpenAI

from .models import Phone
from .serializers import PhoneSerializer, ChatRequestSerializer, CompareRequestSerializer


class ChatView(APIView):
    """
    Handle chat messages and return AI-powered responses.
    Uses LangGraph agent with anti-hallucination guardrails.
    POST /api/chat/
    """
    
    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid request', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        query = serializer.validated_data['query']
        filters = serializer.validated_data.get('filters', {})
        history = serializer.validated_data.get('history', [])
        
        if not query or not query.strip():
            return Response(
                {'error': 'Query is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # SAFETY CHECK FIRST - Block adversarial prompts before any processing
        safety_result = self._check_safety(query)
        if safety_result:
            return Response(safety_result)
        
        # Try LangGraph agent first (robust, anti-hallucination)
        try:
            from ai.graph import run_agent_sync
            
            # Convert history format - include phones for context
            agent_history = []
            for msg in history:
                if isinstance(msg, dict):
                    agent_history.append({
                        'role': msg.get('role', 'user'),
                        'content': msg.get('content', ''),
                        'phones': msg.get('phones', [])  # Include phones for context
                    })
            
            result = run_agent_sync(query, agent_history)
            
            if result.get('error'):
                # Agent encountered an error, use fallback
                raise Exception(result['error'])
            
            return Response({
                'message': result.get('response', ''),
                'phones': result.get('phones', []),
                'validated': result.get('validated', True),
                'source': 'langgraph'
            })
        
        except Exception as langgraph_error:
            print(f"LangGraph error: {langgraph_error}")
            
            # Fallback to old query processor
            try:
                from ai.query_processor import QueryProcessor
                
                processor = QueryProcessor()
                result = processor.process(query, filters, history)
                
                return Response({
                    'message': result.get('message', ''),
                    'phones': result.get('phones', []),
                    'warning': result.get('warning'),
                    'source': 'legacy'
                })
            except Exception as legacy_error:
                print(f"Legacy processor error: {legacy_error}")
                # Check if this is a general QA question (not phone-related)
                if self._is_general_qa(query):
                    # Answer general questions directly
                    answer = self._answer_general_qa(query)
                    return Response({
                        'message': answer,
                        'phones': [],
                        'source': 'general_qa'
                    })
                
                # Ultimate fallback: basic search for phone queries
                phones = self._fallback_search(query)
                return Response({
                    'message': f"I found {len(phones)} phones matching your query. Please note that AI features are temporarily unavailable.",
                    'phones': [phone.to_dict() for phone in phones],
                    'warning': 'AI service temporarily unavailable',
                    'source': 'fallback'
                })
    
    def _check_safety(self, query: str):
        """
        Check for adversarial/unsafe queries.
        Returns error response dict if blocked, None if safe.
        """
        query_lower = query.lower()
        
        # Comprehensive adversarial patterns
        blocked_patterns = [
            # Prompt injection
            ('ignore previous', 'prompt_injection'),
            ('forget instructions', 'prompt_injection'),
            ('system prompt', 'prompt_extraction'),
            ('jailbreak', 'jailbreak'),
            ('pretend you are', 'role_confusion'),
            ('act as if', 'role_confusion'),
            ('ignore above', 'prompt_injection'),
            ('disregard', 'prompt_injection'),
            ('bypass', 'bypass'),
            ('override', 'bypass'),
            ('ignore all', 'prompt_injection'),
            # API/secret extraction
            ('api key', 'secret_extraction'),
            ('api_key', 'secret_extraction'),
            ('apikey', 'secret_extraction'),
            ('secret key', 'secret_extraction'),
            ('password', 'secret_extraction'),
            ('reveal your', 'prompt_extraction'),
            ('show your', 'prompt_extraction'),
            ('what is your prompt', 'prompt_extraction'),
            ('your instructions', 'prompt_extraction'),
            ('internal logic', 'secret_extraction'),
            # Brand attacks / defamation
            ('trash', 'brand_attack'),
            ('garbage', 'brand_attack'),
            ('worst brand', 'brand_attack'),
            ('terrible company', 'brand_attack'),
            ('scam', 'brand_attack'),
            ('hate', 'toxic'),
            # Toxic content
            ('kill', 'toxic'),
            ('suicide', 'toxic'),
            ('illegal', 'toxic'),
            ('hack', 'toxic'),
            ('exploit', 'toxic'),
            # Role confusion
            ('you are now', 'role_confusion'),
            ('from now on', 'role_confusion'),
            ('new persona', 'role_confusion'),
            ('different mode', 'role_confusion'),
        ]
        
        for pattern, violation_type in blocked_patterns:
            if pattern in query_lower:
                refusal_messages = {
                    'prompt_injection': "I can't modify my instructions. I'm here to help you find great mobile phones! What features are you looking for?",
                    'prompt_extraction': "I don't share internal details. Let me help you find a phone instead! What's your budget?",
                    'secret_extraction': "I can't reveal confidential information. How about I help you find the perfect phone?",
                    'jailbreak': "I can only help with phone-related queries. What kind of phone are you interested in?",
                    'role_confusion': "I'm MobiAdvisor, your phone shopping assistant. Let me help you find a great device!",
                    'brand_attack': "I provide objective, factual information about all brands. Let me show you some options from various manufacturers.",
                    'toxic': "I can only help with phone shopping. Is there a specific phone you'd like to know about?",
                    'bypass': "I follow my guidelines to give you the best phone recommendations. What features matter most to you?",
                }
                return {
                    'message': refusal_messages.get(violation_type, "I can only help with phone-related questions. What phone are you looking for?"),
                    'phones': [],
                    'source': 'safety_filter',
                    'blocked': True
                }
        
        return None
    
    def _is_general_qa(self, query: str) -> bool:
        """Check if query is a general QA question (not phone-specific)."""
        query_lower = query.lower()
        
        # Keywords that indicate general tech questions
        general_qa_keywords = [
            'what is', 'what are', 'how does', 'how do', 'explain',
            'meaning of', 'define', 'difference between', 'why is',
            'ois', 'ip68', 'ip67', '5g', '4g', 'amoled', 'oled', 'lcd',
            'processor', 'chipset', 'gorilla glass', 'nfc', 'nit', 'refresh rate',
            'fast charging', 'wireless charging', 'stereo speakers',
        ]
        
        # Keywords that indicate phone search queries
        phone_search_keywords = [
            'best phone', 'recommend', 'under', 'below', 'budget',
            'compare', 'phones', 'mobile', 'buy', 'which phone',
            'samsung', 'apple', 'iphone', 'xiaomi', 'oneplus', 'vivo', 'oppo',
            'first one', 'second', 'tell me more', 'camera', 'battery', 'gaming'
        ]
        
        # Check for general QA patterns
        for keyword in general_qa_keywords:
            if keyword in query_lower:
                # Make sure it's not also a phone search
                if not any(pk in query_lower for pk in phone_search_keywords):
                    return True
        
        return False
    
    def _answer_general_qa(self, query: str) -> str:
        """Answer general technology questions using OpenAI."""
        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": """You are MobiAdvisor, a helpful mobile phone shopping assistant.
                        Answer general questions about mobile phone technology clearly and concisely.
                        Topics include: OIS (Optical Image Stabilization), 5G, IP ratings, display types, processors, etc.
                        Keep responses informative but brief (2-3 paragraphs max)."""
                    },
                    {"role": "user", "content": query}
                ],
                temperature=0.5,
                max_tokens=500
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"General QA error: {e}")
            return f"I'd love to help explain that! However, I'm having trouble connecting right now. {query} is a great question - please try again in a moment."
    
    def _fallback_search(self, query: str):
        """Fallback search when AI is unavailable."""
        query_lower = query.lower()
        phones = Phone.objects.all()
        
        # Simple keyword matching
        if any(brand in query_lower for brand in ['samsung', 'apple', 'xiaomi', 'oneplus', 'vivo', 'oppo']):
            for brand in ['samsung', 'apple', 'xiaomi', 'oneplus', 'vivo', 'oppo']:
                if brand in query_lower:
                    phones = phones.filter(company_name__icontains=brand)
                    break
        
        return phones[:5]


class CompareView(APIView):
    """
    Handle phone comparison with AI analysis.
    POST /api/compare/
    """
    
    def post(self, request):
        serializer = CompareRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid request', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        phones = serializer.validated_data['phones']
        
        if len(phones) < 2:
            return Response(
                {'error': 'At least 2 phones required for comparison'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Build comparison prompt
            phone_details = []
            for i, phone in enumerate(phones, 1):
                details = f"""
Phone {i}: {phone.get('company_name', '')} {phone.get('model_name', '')}
- Price: ₹{phone.get('price_inr', 0):,}
- RAM: {phone.get('ram_gb', 0)}GB
- Storage: {phone.get('memory_gb', 0)}GB
- Battery: {phone.get('battery_mah', 0)}mAh
- Back Camera: {phone.get('back_camera_mp', 0)}MP
- Front Camera: {phone.get('front_camera_mp', 0)}MP
- Screen: {phone.get('screen_size', 0)}"
- User Rating: {phone.get('user_rating', 0)}/5
- Processor: {phone.get('processor', 'Unknown')}
"""
                phone_details.append(details)
            
            prompt = f"""You are a phone comparison expert. Analyze these phones and provide a detailed comparison:

{chr(10).join(phone_details)}

Respond in JSON format with this exact structure:
{{
    "overall": {{"winner": "Phone Name", "reasoning": "Why this phone wins overall"}},
    "gaming": {{"winner": "Phone Name", "reasoning": "Why this is best for gaming"}},
    "photography": {{"winner": "Phone Name", "reasoning": "Why this is best for photos"}},
    "value": {{"winner": "Phone Name", "reasoning": "Why this offers best value for money"}},
    "dailyUse": {{"winner": "Phone Name", "reasoning": "Why this is best for daily use"}},
    "summary": "A 2-3 sentence overall summary of the comparison"
}}"""
            
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are a helpful phone comparison assistant. Always respond in valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            analysis = json.loads(response.choices[0].message.content)
            
            return Response({'analysis': analysis})
        
        except Exception as e:
            print(f"Compare error: {e}")
            return Response(
                {'error': 'Failed to generate comparison analysis'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PhoneListView(APIView):
    """
    List phones with filtering and sorting.
    GET /api/phones/
    """
    
    def get(self, request):
        phones = Phone.objects.all()
        
        # Get query parameters
        search = request.query_params.get('search', '')
        sort_by = request.query_params.get('sortBy', 'user_rating')
        order = request.query_params.get('order', 'desc')
        limit = int(request.query_params.get('limit', 50))
        
        # Filter by company
        company = request.query_params.get('company', '')
        if company:
            phones = phones.filter(company_name__icontains=company)
        
        # Search filter
        if search:
            phones = phones.filter(model_name__icontains=search) | phones.filter(company_name__icontains=search)
        
        # Numeric filters
        min_price = request.query_params.get('minPrice')
        max_price = request.query_params.get('maxPrice')
        min_ram = request.query_params.get('minRam')
        min_battery = request.query_params.get('minBattery')
        min_camera = request.query_params.get('minCamera')
        
        if min_price:
            phones = phones.filter(price_inr__gte=int(min_price))
        if max_price:
            phones = phones.filter(price_inr__lte=int(max_price))
        if min_ram:
            phones = phones.filter(ram_gb__gte=float(min_ram))
        if min_battery:
            phones = phones.filter(battery_mah__gte=int(min_battery))
        if min_camera:
            phones = phones.filter(back_camera_mp__gte=float(min_camera))
        
        # Sorting
        sort_field_map = {
            'price': 'price_inr',
            'rating': 'user_rating',
            'battery': 'battery_mah',
            'camera': 'back_camera_mp',
            'ram': 'ram_gb',
            'storage': 'memory_gb',
        }
        sort_field = sort_field_map.get(sort_by, 'user_rating')
        if order == 'desc':
            sort_field = f'-{sort_field}'
        
        phones = phones.order_by(sort_field)[:limit]
        
        serializer = PhoneSerializer(phones, many=True)
        return Response({
            'phones': serializer.data,
            'total': Phone.objects.count()
        })


class PhoneDetailView(APIView):
    """
    Get a single phone by ID.
    GET /api/phones/<id>/
    """
    
    def get(self, request, pk):
        try:
            phone = Phone.objects.get(pk=pk)
            serializer = PhoneSerializer(phone)
            return Response(serializer.data)
        except Phone.DoesNotExist:
            return Response(
                {'error': 'Phone not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class FiltersView(APIView):
    """
    Get filter metadata for the browse tab.
    GET /api/filters/
    """
    
    def get(self, request):
        from django.db.models import Min, Max
        
        aggregates = Phone.objects.aggregate(
            min_price=Min('price_inr'),
            max_price=Max('price_inr'),
            min_camera=Min('back_camera_mp'),
            max_camera=Max('back_camera_mp'),
            min_battery=Min('battery_mah'),
            max_battery=Max('battery_mah'),
            min_ram=Min('ram_gb'),
            max_ram=Max('ram_gb'),
            min_storage=Min('memory_gb'),
            max_storage=Max('memory_gb'),
        )
        
        companies = list(
            Phone.objects.values_list('company_name', flat=True)
            .distinct()
            .order_by('company_name')
        )
        
        return Response({
            'companies': companies,
            'priceRange': {
                'min': aggregates['min_price'] or 0,
                'max': aggregates['max_price'] or 0
            },
            'cameraRange': {
                'min': aggregates['min_camera'] or 0,
                'max': aggregates['max_camera'] or 0
            },
            'batteryRange': {
                'min': aggregates['min_battery'] or 0,
                'max': aggregates['max_battery'] or 0
            },
            'ramRange': {
                'min': aggregates['min_ram'] or 0,
                'max': aggregates['max_ram'] or 0
            },
            'storageRange': {
                'min': aggregates['min_storage'] or 0,
                'max': aggregates['max_storage'] or 0
            },
        })


class BuildIndexView(APIView):
    """
    Admin endpoint to build/rebuild the vector index.
    POST /api/admin/build-index/
    """
    
    def post(self, request):
        try:
            from ai.vector_client import VectorClient
            
            client = VectorClient()
            result = client.build_product_index()
            
            return Response({
                'success': True,
                'message': 'Vector index built successfully',
                'details': result
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

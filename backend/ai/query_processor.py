"""
Query Processor - Main AI orchestrator.
Ported from src/lib/ai/query-processor.ts
"""

import re
from typing import Optional
from django.db.models import Q

from .llm_client import get_llm_client
from .vector_client import get_vector_client


# Model aliases for better matching
MODEL_ALIASES = {
    # Samsung Galaxy S series
    's24 ultra': 'galaxy s24 ultra',
    's24+': 'galaxy s24+',
    's24': 'galaxy s24',
    's23 ultra': 'galaxy s23 ultra',
    's23+': 'galaxy s23+',
    's23': 'galaxy s23',
    's22': 'galaxy s22',
    's21': 'galaxy s21',
    # Samsung Galaxy A series
    'a54': 'galaxy a54',
    'a34': 'galaxy a34',
    'a24': 'galaxy a24',
    'a14': 'galaxy a14',
    # iPhone
    'iphone 15 pro max': 'iphone 15 pro max',
    'iphone 15 pro': 'iphone 15 pro',
    'iphone 15': 'iphone 15',
    'iphone 14': 'iphone 14',
    'iphone 13': 'iphone 13',
    # OnePlus
    '12r': 'oneplus 12r',
    '12': 'oneplus 12',
    '11r': 'oneplus 11r',
    '11': 'oneplus 11',
    'nord': 'oneplus nord',
    # Xiaomi
    '14 ultra': 'xiaomi 14 ultra',
    '14': 'xiaomi 14',
    'redmi note 13': 'redmi note 13',
    'poco f5': 'poco f5',
    # Realme
    'gt neo': 'realme gt neo',
    'narzo': 'realme narzo',
}

# Company inference from model names
COMPANY_INFERENCE = {
    'galaxy': 'samsung',
    'iphone': 'apple',
    'redmi': 'xiaomi',
    'poco': 'xiaomi',
    'oneplus': 'oneplus',
    'pixel': 'google',
    'moto': 'motorola',
    'realme': 'realme',
    'vivo': 'vivo',
    'oppo': 'oppo',
}


class QueryProcessor:
    """
    Main orchestrator for processing user queries.
    Handles intent parsing, typo correction, query execution, and response generation.
    """
    
    def __init__(self):
        self.llm = get_llm_client()
        self.vector = get_vector_client()
    
    def process(
        self,
        query: str,
        filters: dict = None,
        history: list = None
    ) -> dict:
        """
        Process a user query and return response with phones.
        
        Args:
            query: User's natural language query
            filters: UI filters
            history: Conversation history
            
        Returns:
            dict with 'message' and 'phones'
        """
        if filters is None:
            filters = {}
        if history is None:
            history = []
        
        try:
            # Check for follow-up queries
            is_followup = self._is_followup_query(query)
            is_best_query = self._is_best_phone_query(query)
            
            # Get phones from history if follow-up
            previous_phones = []
            if is_followup or is_best_query:
                previous_phones = self._get_phones_from_history(history)
            
            # If asking for "best" and we have previous phones
            if is_best_query and previous_phones:
                # Return just the highest rated phone
                sorted_phones = sorted(
                    previous_phones,
                    key=lambda p: p.get('user_rating', 0) if isinstance(p, dict) else p.user_rating,
                    reverse=True
                )
                best_phone = sorted_phones[0] if sorted_phones else None
                
                if best_phone:
                    summary = self.llm.summarize(query, [best_phone], history)
                    phone_dict = best_phone if isinstance(best_phone, dict) else best_phone.to_dict()
                    return {
                        'message': summary,
                        'phones': [phone_dict]
                    }
            
            # Parse intent
            intent = self.llm.parse_intent(query, history)
            
            # Handle rejection
            if intent.get('task') == 'reject':
                return {
                    'message': "I'm sorry, I can only help with mobile phone shopping queries. How can I help you find the perfect phone?",
                    'phones': []
                }
            
            # Handle general Q&A
            if intent.get('task') == 'general_qa':
                answer = self.llm.answer_general(query, history)
                return {
                    'message': answer,
                    'phones': []
                }
            
            # Apply typo corrections
            intent = self._apply_corrections(intent)
            
            # Merge UI filters with intent constraints
            merged_filters = self._merge_filters(filters, intent)
            
            # Determine query type and process
            comparison_type = intent.get('comparison_type', 'single')
            models = intent.get('entities', {}).get('model', [])
            companies = intent.get('entities', {}).get('company', [])
            
            # Multi-model comparison
            if comparison_type == 'multi' and len(models) >= 2:
                phones = self._process_multi_model(intent)
            # Multi-brand comparison
            elif len(companies) >= 2:
                phones = self._process_multi_brand(intent)
            # Single/range query
            else:
                phones = self._process_single_query(intent, merged_filters, query)
            
            # Generate summary
            if phones:
                # Convert to dicts if needed
                phone_dicts = []
                for p in phones:
                    if isinstance(p, dict):
                        phone_dicts.append(p)
                    else:
                        phone_dicts.append(p.to_dict())
                
                summary = self.llm.summarize(query, phone_dicts, history)
                return {
                    'message': summary,
                    'phones': phone_dicts
                }
            else:
                return {
                    'message': "I couldn't find any phones matching your criteria. Try adjusting your filters or search terms.",
                    'phones': []
                }
        
        except Exception as e:
            print(f"Query processing error: {e}")
            # Fallback to basic search
            fallback_phones = self._get_fallback_results(query)
            fallback_dicts = [p.to_dict() for p in fallback_phones]
            
            return {
                'message': f"I found {len(fallback_phones)} phones that might match your query. AI features are temporarily unavailable.",
                'phones': fallback_dicts,
                'warning': 'AI service temporarily unavailable'
            }
    
    def _is_followup_query(self, query: str) -> bool:
        """Check if query is a follow-up to previous results."""
        followup_phrases = [
            'tell me more',
            'more about',
            'first one',
            'second one',
            'third one',
            'this one',
            'that one',
            'the first',
            'the second',
            'the third',
            'which one',
            'compare them',
            'between them',
            'these phones',
            'those phones',
        ]
        query_lower = query.lower()
        return any(phrase in query_lower for phrase in followup_phrases)
    
    def _is_best_phone_query(self, query: str) -> bool:
        """Check if user is asking for the best phone recommendation."""
        best_phrases = [
            'which is best',
            'which one is best',
            'best one',
            'recommend one',
            'which should i buy',
            'which would you recommend',
            'best option',
            'top pick',
            'your recommendation',
            'the best',
        ]
        query_lower = query.lower()
        return any(phrase in query_lower for phrase in best_phrases)
    
    def _get_phones_from_history(self, history: list) -> list:
        """Extract phones from conversation history."""
        phones = []
        for msg in reversed(history):
            msg_phones = msg.get('phones', [])
            if msg_phones:
                phones.extend(msg_phones)
                break  # Only get most recent phones
        return phones
    
    def _apply_corrections(self, intent: dict) -> dict:
        """Apply typo corrections to intent entities."""
        entities = intent.get('entities', {})
        
        # Correct company names
        companies = entities.get('company', [])
        corrected_companies = []
        for company in companies:
            similar = self.vector.find_similar(company, 'company')
            if similar and similar[0]['score'] > 0.7:
                corrected_companies.append(similar[0]['metadata']['value'])
            else:
                corrected_companies.append(company)
        
        # Correct model names
        models = entities.get('model', [])
        corrected_models = []
        for model in models:
            # Check aliases first
            model_lower = model.lower()
            if model_lower in MODEL_ALIASES:
                corrected_models.append(MODEL_ALIASES[model_lower])
            else:
                similar = self.vector.find_similar(model, 'model')
                if similar and similar[0]['score'] > 0.7:
                    corrected_models.append(similar[0]['metadata']['value'])
                else:
                    corrected_models.append(model)
        
        intent['entities']['company'] = corrected_companies
        intent['entities']['model'] = corrected_models
        
        return intent
    
    def _merge_filters(self, ui_filters: dict, intent: dict) -> dict:
        """Merge UI filters with intent constraints."""
        constraints = intent.get('constraints', {})
        
        merged = dict(ui_filters)  # Start with UI filters
        
        # Add intent constraints (they take priority)
        if constraints.get('min_price'):
            merged['minPrice'] = constraints['min_price']
        if constraints.get('max_price'):
            merged['maxPrice'] = constraints['max_price']
        if constraints.get('min_ram'):
            merged['minRam'] = constraints['min_ram']
        if constraints.get('min_battery'):
            merged['minBattery'] = constraints['min_battery']
        if constraints.get('min_camera'):
            merged['minCamera'] = constraints['min_camera']
        
        # Add company from entities if not in filters
        companies = intent.get('entities', {}).get('company', [])
        if companies and not merged.get('company'):
            merged['company'] = companies[0]
        
        return merged
    
    def _process_multi_model(self, intent: dict) -> list:
        """Process multi-model comparison query."""
        from api.models import Phone
        
        models = intent.get('entities', {}).get('model', [])
        companies = intent.get('entities', {}).get('company', [])
        
        phones = []
        
        for i, model in enumerate(models):
            model_lower = model.lower()
            
            # Infer company from model name
            inferred_company = None
            for keyword, company in COMPANY_INFERENCE.items():
                if keyword in model_lower:
                    inferred_company = company
                    break
            
            # Use entity company if available
            if i < len(companies):
                inferred_company = companies[i]
            
            # Search strategies
            found = None
            
            # Strategy 1: Direct search with company
            if inferred_company:
                found = Phone.objects.filter(
                    company_name__icontains=inferred_company,
                    model_name__icontains=model_lower.replace(inferred_company, '').strip()
                ).first()
            
            # Strategy 2: Direct model search
            if not found:
                found = Phone.objects.filter(
                    model_name__icontains=model_lower
                ).first()
            
            # Strategy 3: Add "galaxy" prefix for Samsung patterns
            if not found and re.match(r'^[as]\d', model_lower):
                found = Phone.objects.filter(
                    model_name__icontains=f'galaxy {model_lower}'
                ).first()
            
            # Strategy 4: Add "iphone" prefix for Apple patterns
            if not found and re.match(r'^\d{2}', model_lower):
                found = Phone.objects.filter(
                    model_name__icontains=f'iphone {model_lower}'
                ).first()
            
            if found:
                phones.append(found)
        
        return phones
    
    def _process_multi_brand(self, intent: dict) -> list:
        """Process multi-brand comparison query."""
        from api.models import Phone
        
        companies = intent.get('entities', {}).get('company', [])
        phones = []
        
        for company in companies:
            brand_phones = Phone.objects.filter(
                company_name__icontains=company
            ).order_by('-user_rating')[:3]
            phones.extend(list(brand_phones))
        
        return phones
    
    def _process_single_query(
        self,
        intent: dict,
        filters: dict,
        original_query: str
    ) -> list:
        """Process single search query with RAG fallback."""
        from api.models import Phone
        
        # Step 1: Try semantic search (RAG)
        try:
            phones = self.vector.search_products(original_query, filters, top_k=5)
            if phones:
                return phones
        except Exception as e:
            print(f"Semantic search failed: {e}")
        
        # Step 2: Try SQL generation
        try:
            sql = self.llm.generate_sql(intent, filters)
            if sql:
                # Execute SQL safely (this is simplified - use raw queries carefully)
                # For safety, we'll build the query using ORM instead
                pass
        except Exception as e:
            print(f"SQL generation failed: {e}")
        
        # Step 3: Fallback to filter-based query
        phones = Phone.objects.all()
        
        # Apply filters
        if filters.get('company'):
            phones = phones.filter(company_name__icontains=filters['company'])
        if filters.get('minPrice'):
            phones = phones.filter(price_inr__gte=int(filters['minPrice']))
        if filters.get('maxPrice'):
            phones = phones.filter(price_inr__lte=int(filters['maxPrice']))
        if filters.get('minRam'):
            phones = phones.filter(ram_gb__gte=float(filters['minRam']))
        if filters.get('minBattery'):
            phones = phones.filter(battery_mah__gte=int(filters['minBattery']))
        if filters.get('minCamera'):
            phones = phones.filter(back_camera_mp__gte=float(filters['minCamera']))
        
        # Apply priority features sorting
        priority = intent.get('priority_features', [])
        if 'camera' in priority:
            phones = phones.order_by('-back_camera_mp', '-user_rating')
        elif 'battery' in priority:
            phones = phones.order_by('-battery_mah', '-user_rating')
        elif 'performance' in priority or 'gaming' in priority:
            phones = phones.order_by('-ram_gb', '-performance_rating', '-user_rating')
        else:
            phones = phones.order_by('-user_rating')
        
        return list(phones[:5])
    
    def _get_fallback_results(self, query: str) -> list:
        """Get fallback results when AI fails."""
        from api.models import Phone
        
        query_lower = query.lower()
        phones = Phone.objects.all()
        
        # Simple keyword matching
        keywords = query_lower.split()
        q_objects = Q()
        
        for keyword in keywords:
            if len(keyword) >= 3:
                q_objects |= Q(model_name__icontains=keyword)
                q_objects |= Q(company_name__icontains=keyword)
        
        if q_objects:
            phones = phones.filter(q_objects)
        
        return list(phones.order_by('-user_rating')[:5])

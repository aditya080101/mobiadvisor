"""
Vector Client for Pinecone interactions.
Ported from src/lib/vector/vector-client.ts
"""

import os
from typing import Optional
from django.conf import settings

try:
    from pinecone import Pinecone
    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False
    print("Pinecone not available, using fallback search")

from .llm_client import get_llm_client


class VectorClient:
    """
    Client for Pinecone vector database operations.
    Handles similarity search for typo correction and semantic product search.
    """
    
    _instance: Optional['VectorClient'] = None
    
    def __new__(cls):
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.api_key = settings.PINECONE_API_KEY
        self.index_name = settings.PINECONE_INDEX_NAME
        self.pinecone = None
        self.index = None
        self.available = False
        
        if PINECONE_AVAILABLE and self.api_key:
            try:
                self.pinecone = Pinecone(api_key=self.api_key)
                self.index = self.pinecone.Index(self.index_name)
                self.available = True
            except Exception as e:
                print(f"Pinecone initialization error: {e}")
        
        self._initialized = True
    
    def find_similar(
        self,
        query: str,
        type_filter: str = None,
        company_filter: str = None,
        threshold: float = 0.7
    ) -> list:
        """
        Find similar company/model names for typo correction.
        
        Args:
            query: Search query
            type_filter: 'company' or 'model'
            company_filter: Filter by specific company
            threshold: Minimum similarity score
            
        Returns:
            List of similar matches with scores
        """
        if not self.available:
            return self._fallback_similar(query, type_filter)
        
        try:
            llm = get_llm_client()
            embedding = llm.embed(query)
            
            if not embedding:
                return self._fallback_similar(query, type_filter)
            
            # Build filter
            filter_dict = {}
            if type_filter:
                filter_dict['type'] = type_filter
            if company_filter:
                filter_dict['company'] = company_filter.lower()
            
            results = self.index.query(
                vector=embedding,
                top_k=5,
                include_metadata=True,
                filter=filter_dict if filter_dict else None
            )
            
            matches = []
            for match in results.get('matches', []):
                if match['score'] >= threshold:
                    matches.append({
                        'id': match['id'],
                        'score': match['score'],
                        'metadata': match.get('metadata', {})
                    })
            
            return matches
            
        except Exception as e:
            print(f"Vector search error: {e}")
            return self._fallback_similar(query, type_filter)
    
    def _fallback_similar(self, query: str, type_filter: str = None) -> list:
        """
        Fallback similarity search using string matching.
        """
        from api.models import Phone
        
        query_lower = query.lower()
        matches = []
        
        if type_filter == 'company' or type_filter is None:
            # Get unique companies
            companies = list(
                Phone.objects.values_list('company_name', flat=True).distinct()
            )
            for company in companies:
                score = self._string_similarity(query_lower, company.lower())
                if score >= 0.6:
                    matches.append({
                        'id': f"company_{company}",
                        'score': score,
                        'metadata': {'type': 'company', 'value': company}
                    })
        
        if type_filter == 'model' or type_filter is None:
            # Get models (limited)
            models = Phone.objects.values('model_name', 'company_name')[:100]
            for m in models:
                score = self._string_similarity(query_lower, m['model_name'].lower())
                if score >= 0.5:
                    matches.append({
                        'id': f"model_{m['model_name']}",
                        'score': score,
                        'metadata': {
                            'type': 'model',
                            'value': m['model_name'],
                            'company': m['company_name']
                        }
                    })
        
        # Sort by score descending
        matches.sort(key=lambda x: x['score'], reverse=True)
        return matches[:5]
    
    def _string_similarity(self, s1: str, s2: str) -> float:
        """
        Calculate string similarity using Levenshtein-like ratio.
        """
        if s1 == s2:
            return 1.0
        
        # Simple substring matching
        if s1 in s2 or s2 in s1:
            return 0.8
        
        # Character overlap
        set1 = set(s1)
        set2 = set(s2)
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        
        return intersection / union if union > 0 else 0.0
    
    def search_products(
        self,
        query: str,
        filters: dict = None,
        top_k: int = 5
    ) -> list:
        """
        Semantic search for phones.
        
        Args:
            query: Natural language search query
            filters: Optional filters (company, price range, etc.)
            top_k: Number of results to return
            
        Returns:
            List of Phone objects
        """
        from api.models import Phone
        
        if not self.available:
            return self._fallback_search(query, filters, top_k)
        
        try:
            llm = get_llm_client()
            embedding = llm.embed(query)
            
            if not embedding:
                return self._fallback_search(query, filters, top_k)
            
            # Build Pinecone filter from filters dict
            pinecone_filter = {'type': 'product'}
            if filters:
                if filters.get('company'):
                    pinecone_filter['company'] = filters['company'].lower()
            
            results = self.index.query(
                vector=embedding,
                top_k=top_k,
                include_metadata=True,
                filter=pinecone_filter,
                namespace='products'
            )
            
            # Get phone IDs from results
            phone_ids = []
            for match in results.get('matches', []):
                phone_id = match.get('metadata', {}).get('phone_id')
                if phone_id:
                    phone_ids.append(int(phone_id))
            
            if not phone_ids:
                return self._fallback_search(query, filters, top_k)
            
            # Fetch full phone data
            phones = list(Phone.objects.filter(id__in=phone_ids))
            
            # Additional filtering
            if filters:
                phones = self._apply_filters(phones, filters)
            
            return phones
            
        except Exception as e:
            print(f"Product search error: {e}")
            return self._fallback_search(query, filters, top_k)
    
    def _fallback_search(self, query: str, filters: dict = None, top_k: int = 5) -> list:
        """
        Fallback search using database queries.
        """
        from api.models import Phone
        from django.db.models import Q
        
        phones = Phone.objects.all()
        query_lower = query.lower()
        
        # Keyword-based search
        keywords = query_lower.split()
        q_objects = Q()
        
        for keyword in keywords:
            q_objects |= Q(model_name__icontains=keyword)
            q_objects |= Q(company_name__icontains=keyword)
            q_objects |= Q(processor__icontains=keyword)
        
        if q_objects:
            phones = phones.filter(q_objects)
        
        # Apply filters
        if filters:
            phones = self._apply_filters_queryset(phones, filters)
        
        return list(phones.order_by('-user_rating')[:top_k])
    
    def _apply_filters(self, phones: list, filters: dict) -> list:
        """Apply filters to a list of Phone objects."""
        result = phones
        
        if filters.get('company'):
            result = [p for p in result if p.company_name.lower() == filters['company'].lower()]
        if filters.get('minPrice'):
            result = [p for p in result if p.price_inr >= int(filters['minPrice'])]
        if filters.get('maxPrice'):
            result = [p for p in result if p.price_inr <= int(filters['maxPrice'])]
        if filters.get('minRam'):
            result = [p for p in result if p.ram_gb >= float(filters['minRam'])]
        if filters.get('minBattery'):
            result = [p for p in result if p.battery_mah >= int(filters['minBattery'])]
        if filters.get('minCamera'):
            result = [p for p in result if p.back_camera_mp >= float(filters['minCamera'])]
        
        return result
    
    def _apply_filters_queryset(self, queryset, filters: dict):
        """Apply filters to a Django queryset."""
        if filters.get('company'):
            queryset = queryset.filter(company_name__icontains=filters['company'])
        if filters.get('minPrice'):
            queryset = queryset.filter(price_inr__gte=int(filters['minPrice']))
        if filters.get('maxPrice'):
            queryset = queryset.filter(price_inr__lte=int(filters['maxPrice']))
        if filters.get('minRam'):
            queryset = queryset.filter(ram_gb__gte=float(filters['minRam']))
        if filters.get('minBattery'):
            queryset = queryset.filter(battery_mah__gte=int(filters['minBattery']))
        if filters.get('minCamera'):
            queryset = queryset.filter(back_camera_mp__gte=float(filters['minCamera']))
        
        return queryset
    
    def build_product_index(self) -> dict:
        """
        Build/rebuild the product index in Pinecone.
        
        Returns:
            Status information
        """
        from api.models import Phone
        
        if not self.available:
            return {'success': False, 'error': 'Pinecone not available'}
        
        try:
            llm = get_llm_client()
            phones = Phone.objects.all()
            
            indexed = 0
            errors = 0
            
            for phone in phones:
                # Create rich description for embedding
                description = self._create_phone_description(phone)
                embedding = llm.embed(description)
                
                if not embedding:
                    errors += 1
                    continue
                
                # Upsert to Pinecone
                self.index.upsert(
                    vectors=[{
                        'id': f"phone_{phone.id}",
                        'values': embedding,
                        'metadata': {
                            'type': 'product',
                            'phone_id': phone.id,
                            'company': phone.company_name.lower(),
                            'model': phone.model_name.lower(),
                            'price': phone.price_inr,
                        }
                    }],
                    namespace='products'
                )
                indexed += 1
            
            return {
                'success': True,
                'indexed': indexed,
                'errors': errors,
                'total': phones.count()
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _create_phone_description(self, phone) -> str:
        """Create a rich text description for embedding."""
        features = []
        
        # Price tier
        if phone.price_inr < 15000:
            features.append("budget affordable cheap economical")
        elif phone.price_inr < 30000:
            features.append("mid-range balanced value")
        elif phone.price_inr < 50000:
            features.append("upper mid-range premium features")
        else:
            features.append("flagship premium high-end")
        
        # Camera
        if phone.back_camera_mp >= 100:
            features.append("excellent camera photography flagship camera")
        elif phone.back_camera_mp >= 50:
            features.append("good camera photography")
        
        # Battery
        if phone.battery_mah >= 5000:
            features.append("long battery life all-day battery")
        
        # RAM (gaming)
        if phone.ram_gb >= 8:
            features.append("gaming smooth performance multitasking")
        
        return f"""
{phone.company_name} {phone.model_name} {phone.memory_gb}gb.
Price ₹{phone.price_inr:,}. {phone.ram_gb}GB RAM, {phone.memory_gb}GB storage.
{phone.back_camera_mp}MP rear camera, {phone.front_camera_mp}MP front camera.
{phone.battery_mah}mAh battery. {phone.screen_size}" display.
Processor: {phone.processor or 'Unknown'}.
Rating: {phone.user_rating}/5.
Features: {' '.join(features)}.
""".strip()


# Singleton getter
_vector_client = None

def get_vector_client() -> VectorClient:
    """Get or create the Vector client singleton."""
    global _vector_client
    if _vector_client is None:
        _vector_client = VectorClient()
    return _vector_client

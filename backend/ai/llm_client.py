"""
LLM Client for OpenAI interactions.
Ported from src/lib/ai/llm-client.ts
"""

import json
import os
from typing import Optional
from django.conf import settings
from openai import OpenAI

from .prompts import (
    INTENT_PROMPT,
    NL2SQL_PROMPT,
    SUMMARY_PROMPT,
    GENERAL_QA_PROMPT,
    SYSTEM_PROMPT,
)


class LLMClient:
    """
    Client for interacting with OpenAI API.
    Handles intent parsing, SQL generation, summarization, and embeddings.
    """
    
    _instance: Optional['LLMClient'] = None
    
    def __new__(cls):
        """Singleton pattern for LLM client."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL
        self.embedding_model = settings.OPENAI_EMBEDDING_MODEL
        
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY not configured")
        
        self.client = OpenAI(api_key=self.api_key)
        self._initialized = True
    
    def parse_intent(self, query: str, history: list = None) -> dict:
        """
        Parse user query to extract structured intent.
        
        Args:
            query: User's natural language query
            history: Previous conversation messages
            
        Returns:
            Parsed intent with task, entities, constraints, and comparison_type
        """
        if history is None:
            history = []
        
        prompt = INTENT_PROMPT.replace('{query}', query)
        
        # Build context from history
        messages = [{"role": "system", "content": "You are a query parser. Respond only with valid JSON."}]
        
        # Add last 4 history messages for context
        for msg in history[-4:]:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if content:
                messages.append({"role": role, "content": content})
        
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=500,
            )
            
            content = response.choices[0].message.content
            intent = json.loads(content)
            
            # Normalize the intent structure
            return self._normalize_intent(intent)
            
        except Exception as e:
            print(f"Intent parsing error: {e}")
            # Return default intent on error
            return {
                'task': 'query',
                'entities': {'company': [], 'model': [], 'features': []},
                'constraints': {},
                'comparison_type': 'single',
                'priority_features': [],
            }
    
    def _normalize_intent(self, intent: dict) -> dict:
        """Normalize intent structure with default values."""
        return {
            'task': intent.get('task', 'query'),
            'entities': {
                'company': intent.get('entities', {}).get('company', []) or [],
                'model': intent.get('entities', {}).get('model', []) or [],
                'features': intent.get('entities', {}).get('features', []) or [],
            },
            'constraints': intent.get('constraints', {}),
            'comparison_type': intent.get('comparison_type', 'single'),
            'priority_features': intent.get('priority_features', []) or [],
        }
    
    def generate_sql(self, intent: dict, filters: dict = None) -> str:
        """
        Generate SQL query from intent.
        
        Args:
            intent: Parsed user intent
            filters: Additional filters from UI
            
        Returns:
            SQL SELECT query string
        """
        if filters is None:
            filters = {}
        
        # Combine intent and filters for context
        context = json.dumps({
            'intent': intent,
            'filters': filters,
        }, indent=2)
        
        prompt = NL2SQL_PROMPT.replace('{intent}', context)
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You generate SQL queries. Respond only with the SQL query, no explanation."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=300,
            )
            
            sql = response.choices[0].message.content.strip()
            
            # Validate it's a SELECT statement
            if not sql.upper().startswith('SELECT'):
                raise ValueError("Generated query is not a SELECT statement")
            
            return sql
            
        except Exception as e:
            print(f"SQL generation error: {e}")
            return None
    
    def summarize(self, query: str, phones: list, history: list = None) -> str:
        """
        Generate a conversational summary of phone results.
        
        Args:
            query: Original user query
            phones: List of phone dictionaries
            history: Conversation history
            
        Returns:
            Markdown-formatted response
        """
        if history is None:
            history = []
        
        # Format phone data
        phone_data_lines = []
        for i, phone in enumerate(phones, 1):
            if isinstance(phone, dict):
                phone_data_lines.append(f"""
Phone {i}: {phone.get('company_name', '')} {phone.get('model_name', '')}
- Price: ₹{phone.get('price_inr', 0):,}
- RAM: {phone.get('ram_gb', 0)}GB | Storage: {phone.get('memory_gb', 0)}GB
- Camera: {phone.get('back_camera_mp', 0)}MP rear, {phone.get('front_camera_mp', 0)}MP front
- Battery: {phone.get('battery_mah', 0)}mAh
- Rating: {phone.get('user_rating', 0)}/5
- Processor: {phone.get('processor', 'N/A')}
""")
            else:
                # Phone is a model object
                phone_data_lines.append(f"""
Phone {i}: {phone.company_name} {phone.model_name}
- Price: ₹{phone.price_inr:,}
- RAM: {phone.ram_gb}GB | Storage: {phone.memory_gb}GB
- Camera: {phone.back_camera_mp}MP rear, {phone.front_camera_mp}MP front
- Battery: {phone.battery_mah}mAh
- Rating: {phone.user_rating}/5
- Processor: {phone.processor or 'N/A'}
""")
        
        phone_data = '\n'.join(phone_data_lines) if phone_data_lines else 'No phones found matching your criteria.'
        
        prompt = SUMMARY_PROMPT.replace('{query}', query).replace('{phone_data}', phone_data)
        
        # Build messages with history
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        for msg in history[-4:]:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if content:
                messages.append({"role": role, "content": content})
        
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=1000,
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"Summarization error: {e}")
            return self._fallback_summary(phones)
    
    def _fallback_summary(self, phones: list) -> str:
        """Generate a simple fallback summary."""
        if not phones:
            return "I couldn't find any phones matching your criteria."
        
        phone_list = []
        for phone in phones[:5]:
            if isinstance(phone, dict):
                name = f"{phone.get('company_name', '')} {phone.get('model_name', '')}"
                price = phone.get('price_inr', 0)
            else:
                name = f"{phone.company_name} {phone.model_name}"
                price = phone.price_inr
            phone_list.append(f"- **{name}** - ₹{price:,}")
        
        return f"Here are {len(phones)} phones I found:\n\n" + '\n'.join(phone_list)
    
    def answer_general(self, query: str, history: list = None) -> str:
        """
        Answer general questions about phones/technology.
        
        Args:
            query: User's question
            history: Conversation history
            
        Returns:
            Answer text
        """
        if history is None:
            history = []
        
        prompt = GENERAL_QA_PROMPT.replace('{query}', query)
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        
        for msg in history[-4:]:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if content:
                messages.append({"role": role, "content": content})
        
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=500,
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"General QA error: {e}")
            return "I'm sorry, I couldn't process your question. Please try again."
    
    def embed(self, text: str) -> list:
        """
        Generate embedding for text.
        
        Args:
            text: Text to embed
            
        Returns:
            List of floats (embedding vector)
        """
        try:
            response = self.client.embeddings.create(
                model=self.embedding_model,
                input=text,
            )
            
            return response.data[0].embedding
            
        except Exception as e:
            print(f"Embedding error: {e}")
            return []


# Singleton getter
_llm_client = None

def get_llm_client() -> LLMClient:
    """Get or create the LLM client singleton."""
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client

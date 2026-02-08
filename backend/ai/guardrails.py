"""
Input/output guardrails to prevent hallucination.
Validates LLM responses against actual database data.
"""

from typing import Optional
from django.db.models import Q

from api.models import Phone
from .schemas import GroundedResponse, PhoneSpec, ValidationError


class InputGuardrail:
    """Validates and sanitizes user input."""
    
    # Topics we can handle
    ALLOWED_TOPICS = {
        # Phone-related
        'phone', 'mobile', 'smartphone', 'device', 'handset',
        # Specs
        'camera', 'battery', 'price', 'ram', 'storage', 'memory',
        'display', 'screen', 'processor', 'chip', 'soc',
        # Brands
        'samsung', 'apple', 'iphone', 'oneplus', 'xiaomi', 'google', 'pixel',
        'vivo', 'oppo', 'realme', 'poco', 'motorola', 'nothing', 'honor',
        'huawei', 'infinix', 'iqoo', 'asus', 'rog', 'redmi', 'nokia',
        # Actions
        'compare', 'recommend', 'suggest', 'best', 'cheap', 'budget',
        'premium', 'flagship', 'mid-range', 'affordable',
        # Use cases
        'gaming', 'photography', 'video', 'selfie', 'vlogging',
        # General tech topics (for QA)
        'ois', 'eis', '5g', '4g', 'lte', 'wifi', 'bluetooth', 'nfc',
        'amoled', 'oled', 'lcd', 'ips', 'refresh', 'hz', 'hdr',
        'ip68', 'ip67', 'water', 'dust', 'resistant', 'gorilla',
        'charging', 'watt', 'fast', 'wireless', 'usb', 'type-c',
        'fingerprint', 'face', 'unlock', 'megapixel', 'mp', 'sensor',
        # Query words
        'what', 'how', 'why', 'which', 'explain', 'difference', 'meaning',
        'tell', 'show', 'more', 'detail', 'first', 'second', 'this', 'it'
    }
    
    # Blocked content - comprehensive adversarial patterns
    BLOCKED_PATTERNS = [
        # Prompt injection
        'ignore previous', 'forget instructions', 'system prompt',
        'jailbreak', 'pretend you are', 'act as if', 'ignore above',
        'disregard', 'bypass', 'override', 'ignore all',
        # API/secret extraction
        'api key', 'api_key', 'apikey', 'secret key', 'password',
        'reveal your', 'show your', 'what is your prompt', 'your instructions',
        'internal logic', 'source code', 'backend', 'configuration',
        # Brand attacks / defamation
        'trash', 'garbage', 'worst brand', 'terrible company', 'scam',
        'defame', 'attack', 'destroy', 'hate',
        # Toxic content
        'kill', 'die', 'suicide', 'illegal', 'hack', 'exploit',
        # Role confusion
        'you are now', 'from now on', 'new persona', 'different mode'
    ]
    
    def validate(self, query: str) -> tuple[bool, Optional[str]]:
        """
        Validate input query.
        Returns (is_valid, error_message).
        """
        query_lower = query.lower()
        
        # Check for prompt injection attempts
        for pattern in self.BLOCKED_PATTERNS:
            if pattern in query_lower:
                return False, "I can't help with that request. I'm here to help you find and compare mobile phones. How can I assist you with your phone search?"
        
        # Check if query is relevant to phones or general tech
        if not self._is_phone_related(query_lower):
            return False, "I specialize in mobile phones and related technology. Please ask about phones, their features, comparisons, or tech concepts like 5G, OIS, etc."
        
        return True, None
    
    def _is_phone_related(self, query: str) -> bool:
        """Check if query is related to phones or general tech."""
        # Allow short follow-up queries like "tell me more"
        if len(query.split()) <= 5:
            return True
        return any(topic in query for topic in self.ALLOWED_TOPICS)


class OutputGuardrail:
    """Validates LLM outputs against database."""
    
    def validate_phone_ids(self, phone_ids: list[int]) -> tuple[bool, list[int]]:
        """
        Validate that phone IDs exist in database.
        Returns (all_valid, valid_ids).
        """
        if not phone_ids:
            return True, []
        
        existing = Phone.objects.filter(id__in=phone_ids).values_list('id', flat=True)
        existing_set = set(existing)
        valid_ids = [pid for pid in phone_ids if pid in existing_set]
        
        return len(valid_ids) == len(phone_ids), valid_ids
    
    def validate_phone_spec(self, spec: dict) -> tuple[bool, Optional[str]]:
        """
        Validate phone specification against database.
        Returns (is_valid, error_message).
        """
        phone_id = spec.get('phone_id')
        if not phone_id:
            return False, "Missing phone_id"
        
        try:
            phone = Phone.objects.get(id=phone_id)
        except Phone.DoesNotExist:
            return False, f"Phone ID {phone_id} does not exist"
        
        # Validate critical specs match database
        errors = []
        
        if spec.get('price_inr') and abs(spec['price_inr'] - (phone.price_inr or 0)) > 1000:
            errors.append(f"Price mismatch: LLM said {spec['price_inr']}, DB has {phone.price_inr}")
        
        if spec.get('battery_mah') and abs(spec['battery_mah'] - (phone.battery_mah or 0)) > 100:
            errors.append(f"Battery mismatch: LLM said {spec['battery_mah']}, DB has {phone.battery_mah}")
        
        if errors:
            return False, "; ".join(errors)
        
        return True, None
    
    def validate_grounded_response(self, response: GroundedResponse) -> tuple[bool, Optional[ValidationError]]:
        """
        Validate that a grounded response is actually grounded.
        """
        # Check all referenced phone IDs exist
        all_valid, valid_ids = self.validate_phone_ids(response.source_phone_ids)
        
        if not all_valid:
            return False, ValidationError(
                error_type="hallucination",
                message="Response references non-existent phones",
                original_query="",
                suggested_action="Regenerate with valid phone IDs"
            )
        
        # If response mentions prices, validate they're close to database
        if '₹' in response.message and response.source_phone_ids:
            # Get actual phones and their prices
            phones = Phone.objects.filter(id__in=response.source_phone_ids)
            actual_prices = {p.id: p.price_inr for p in phones}
            
            # Check for obviously fabricated prices
            import re
            mentioned_prices = re.findall(r'₹([\d,]+)', response.message)
            for price_str in mentioned_prices:
                price = int(price_str.replace(',', ''))
                # Check if this price is close to any actual phone price
                if not any(abs(price - (ap or 0)) < 5000 for ap in actual_prices.values()):
                    # Allow if it's a reasonable price in general range
                    if price < 5000 or price > 500000:
                        return False, ValidationError(
                            error_type="hallucination",
                            message=f"Price ₹{price_str} doesn't match any phones in response",
                            original_query="",
                            suggested_action="Use actual prices from database"
                        )
        
        return True, None


class FactChecker:
    """Validates facts against database."""
    
    def get_phone_by_id(self, phone_id: int) -> Optional[Phone]:
        """Get phone from database."""
        try:
            return Phone.objects.get(id=phone_id)
        except Phone.DoesNotExist:
            return None
    
    def verify_claim(self, claim: str, phone_id: int) -> tuple[bool, str]:
        """
        Verify a claim about a phone.
        Returns (is_accurate, correction).
        """
        phone = self.get_phone_by_id(phone_id)
        if not phone:
            return False, f"Phone ID {phone_id} not found"
        
        claim_lower = claim.lower()
        
        # Check price claims
        if 'price' in claim_lower or '₹' in claim:
            actual_price = phone.price_inr or 0
            import re
            prices = re.findall(r'₹?([\d,]+)', claim)
            if prices:
                claimed_price = int(prices[0].replace(',', ''))
                if abs(claimed_price - actual_price) > 5000:
                    return False, f"Actual price is ₹{actual_price:,}"
        
        # Check battery claims
        if 'battery' in claim_lower or 'mah' in claim_lower:
            actual_battery = phone.battery_mah or 0
            import re
            batteries = re.findall(r'(\d+)\s*mah', claim_lower)
            if batteries:
                claimed_battery = int(batteries[0])
                if abs(claimed_battery - actual_battery) > 200:
                    return False, f"Actual battery is {actual_battery}mAh"
        
        return True, ""
    
    def build_phone_spec(self, phone: Phone) -> PhoneSpec:
        """Build verified PhoneSpec from database phone."""
        return PhoneSpec(
            phone_id=phone.id,
            company_name=phone.company_name or "",
            model_name=phone.model_name or "",
            price_inr=phone.price_inr or 0,
            battery_mah=phone.battery_mah or 0,
            ram_gb=phone.ram_gb or 0,
            back_camera_mp=phone.back_camera_mp or 0,
            user_rating=phone.user_rating or 0
        )


# Singleton instances
input_guardrail = InputGuardrail()
output_guardrail = OutputGuardrail()
fact_checker = FactChecker()

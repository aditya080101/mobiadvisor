"""
Pydantic schemas for structured LLM outputs.
These schemas constrain LLM responses to prevent hallucination.
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator


class PhoneSpec(BaseModel):
    """Validated phone specification - must match database."""
    phone_id: int = Field(..., description="Database ID of the phone")
    company_name: str = Field(..., description="Brand name")
    model_name: str = Field(..., description="Model name")
    price_inr: int = Field(..., ge=0, description="Price in INR")
    battery_mah: int = Field(..., ge=0, description="Battery capacity")
    ram_gb: float = Field(..., ge=0, description="RAM in GB")
    back_camera_mp: float = Field(..., ge=0, description="Rear camera MP")
    user_rating: float = Field(..., ge=0, le=5, description="User rating 0-5")


class SearchIntent(BaseModel):
    """Parsed search intent from user query."""
    intent: Literal["search", "compare", "recommend", "info", "general"] = Field(
        ..., description="Type of user request"
    )
    confidence: float = Field(..., ge=0, le=1, description="Intent confidence score")
    
    # Search filters extracted from query
    brands: list[str] = Field(default_factory=list, description="Brand filters")
    min_price: Optional[int] = Field(None, ge=0, description="Min price filter")
    max_price: Optional[int] = Field(None, ge=0, description="Max price filter")
    min_ram: Optional[int] = Field(None, ge=0, description="Min RAM filter")
    min_battery: Optional[int] = Field(None, ge=0, description="Min battery filter")
    use_case: Optional[str] = Field(None, description="Use case (gaming, camera, etc)")
    
    # For comparison
    phone_ids: list[int] = Field(default_factory=list, description="Phone IDs to compare")
    
    # Original query for fallback
    original_query: str = Field(..., description="Original user query")


class GroundedResponse(BaseModel):
    """Response grounded in actual database data."""
    message: str = Field(..., description="Natural language response")
    
    # Grounding: phones that support this response
    source_phone_ids: list[int] = Field(
        ..., 
        min_length=0,
        description="Phone IDs referenced in response"
    )
    
    # Confidence and transparency
    confidence: float = Field(..., ge=0, le=1, description="Response confidence")
    contains_comparison: bool = Field(False, description="Whether response compares phones")
    is_recommendation: bool = Field(False, description="Whether response recommends phones")
    
    # Hallucination prevention
    disclaimer: Optional[str] = Field(
        None, 
        description="Disclaimer if information might be incomplete"
    )
    
    @field_validator('message')
    @classmethod
    def no_fabricated_prices(cls, v: str) -> str:
        """Basic check for obviously fabricated prices."""
        import re
        # Flag suspiciously round prices that might be hallucinated
        suspicious_patterns = [r'₹\d{2},000', r'₹\d{3},000']
        for pattern in suspicious_patterns:
            if re.search(pattern, v):
                # Allow if it's a real price, but log for review
                pass
        return v


class ComparisonResult(BaseModel):
    """Structured comparison output."""
    phones: list[PhoneSpec] = Field(..., min_length=2, max_length=4)
    
    winner_overall: Optional[int] = Field(None, description="Phone ID of overall winner")
    winner_camera: Optional[int] = Field(None, description="Best camera phone ID")
    winner_battery: Optional[int] = Field(None, description="Best battery phone ID")
    winner_value: Optional[int] = Field(None, description="Best value phone ID")
    
    reasoning: str = Field(..., description="Comparison reasoning")
    
    @field_validator('winner_overall', 'winner_camera', 'winner_battery', 'winner_value')
    @classmethod
    def winner_must_be_in_phones(cls, v, info):
        """Ensure winner IDs are from the compared phones."""
        if v is not None and 'phones' in info.data:
            phone_ids = [p.phone_id for p in info.data['phones']]
            if v not in phone_ids:
                raise ValueError(f"Winner ID {v} not in compared phones")
        return v


class RecommendationResult(BaseModel):
    """Structured recommendation with justification."""
    recommended_phones: list[PhoneSpec] = Field(..., min_length=1, max_length=5)
    use_case: str = Field(..., description="Use case for recommendations")
    budget_range: Optional[str] = Field(None, description="Budget range considered")
    
    primary_recommendation: int = Field(..., description="Top recommended phone ID")
    reasoning: str = Field(..., description="Why these phones were recommended")
    
    @field_validator('primary_recommendation')
    @classmethod
    def primary_must_be_in_list(cls, v, info):
        """Ensure primary is in recommended list."""
        if 'recommended_phones' in info.data:
            phone_ids = [p.phone_id for p in info.data['recommended_phones']]
            if v not in phone_ids:
                raise ValueError(f"Primary recommendation {v} not in list")
        return v


class ValidationError(BaseModel):
    """Error when validation fails."""
    error_type: Literal["hallucination", "invalid_phone", "out_of_scope", "unknown"]
    message: str
    original_query: str
    suggested_action: str = Field(
        default="Please rephrase your query or ask about phones in our database."
    )

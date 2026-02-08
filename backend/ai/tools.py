"""
LangChain tools for MobiAdvisor.
All tools are grounded in database data to prevent hallucination.
"""

from typing import Optional, Annotated
from langchain_core.tools import tool
from django.db.models import Q

from api.models import Phone
from .schemas import PhoneSpec
from .guardrails import fact_checker


@tool
def search_phones(
    query: Annotated[str, "Natural language search query"],
    brands: Annotated[Optional[list[str]], "Filter by brand names"] = None,
    min_price: Annotated[Optional[int], "Minimum price in INR"] = None,
    max_price: Annotated[Optional[int], "Maximum price in INR"] = None,
    min_ram: Annotated[Optional[int], "Minimum RAM in GB"] = None,
    min_battery: Annotated[Optional[int], "Minimum battery in mAh"] = None,
    sort_by: Annotated[str, "Sort field: rating, price, battery, camera"] = "rating",
    limit: Annotated[int, "Max results to return"] = 10
) -> list[dict]:
    """
    Search phones in the database with filters.
    Returns REAL phones from database, never fabricated data.
    """
    queryset = Phone.objects.all()
    
    # Apply text search
    if query:
        query_lower = query.lower()
        queryset = queryset.filter(
            Q(model_name__icontains=query_lower) |
            Q(company_name__icontains=query_lower) |
            Q(processor__icontains=query_lower)
        )
    
    # Apply brand filter
    if brands:
        brand_q = Q()
        for brand in brands:
            brand_q |= Q(company_name__icontains=brand)
        queryset = queryset.filter(brand_q)
    
    # Apply numeric filters
    if min_price:
        queryset = queryset.filter(price_inr__gte=min_price)
    if max_price:
        queryset = queryset.filter(price_inr__lte=max_price)
    if min_ram:
        queryset = queryset.filter(ram_gb__gte=min_ram)
    if min_battery:
        queryset = queryset.filter(battery_mah__gte=min_battery)
    
    # Apply sorting
    sort_map = {
        'rating': '-user_rating',
        'price': 'price_inr',
        'price_desc': '-price_inr',
        'battery': '-battery_mah',
        'camera': '-back_camera_mp'
    }
    order = sort_map.get(sort_by, '-user_rating')
    queryset = queryset.order_by(order)
    
    # Limit results
    phones = queryset[:limit]
    
    # Return verified data from database
    return [
        {
            "phone_id": p.id,
            "company_name": p.company_name,
            "model_name": p.model_name,
            "price_inr": p.price_inr,
            "battery_mah": p.battery_mah,
            "ram_gb": p.ram_gb,
            "memory_gb": p.memory_gb,
            "back_camera_mp": p.back_camera_mp,
            "front_camera_mp": p.front_camera_mp,
            "user_rating": p.user_rating,
            "processor": p.processor,
            "screen_size": p.screen_size
        }
        for p in phones
    ]


@tool
def get_phone_details(
    phone_id: Annotated[int, "Database ID of the phone"]
) -> Optional[dict]:
    """
    Get detailed specifications for a specific phone by ID.
    Returns REAL data from database.
    """
    try:
        phone = Phone.objects.get(id=phone_id)
        return {
            "phone_id": phone.id,
            "company_name": phone.company_name,
            "model_name": phone.model_name,
            "processor": phone.processor,
            "launched_year": phone.launched_year,
            "price_inr": phone.price_inr,
            "battery_mah": phone.battery_mah,
            "ram_gb": phone.ram_gb,
            "memory_gb": phone.memory_gb,
            "back_camera_mp": phone.back_camera_mp,
            "front_camera_mp": phone.front_camera_mp,
            "screen_size": phone.screen_size,
            "weight_g": phone.weight_g,
            "user_rating": phone.user_rating,
            "user_review": phone.user_review,
            "camera_rating": phone.camera_rating,
            "battery_rating": phone.battery_rating,
            "design_rating": phone.design_rating,
            "display_rating": phone.display_rating,
            "performance_rating": phone.performance_rating
        }
    except Phone.DoesNotExist:
        return None


@tool
def compare_phones(
    phone_ids: Annotated[list[int], "List of phone IDs to compare (2-4 phones)"]
) -> dict:
    """
    Compare multiple phones side by side.
    Returns REAL specs from database for comparison.
    """
    if len(phone_ids) < 2:
        return {"error": "Need at least 2 phones to compare"}
    if len(phone_ids) > 4:
        phone_ids = phone_ids[:4]  # Limit to 4
    
    phones = Phone.objects.filter(id__in=phone_ids)
    phone_data = []
    
    for phone in phones:
        phone_data.append({
            "phone_id": phone.id,
            "company_name": phone.company_name,
            "model_name": phone.model_name,
            "price_inr": phone.price_inr,
            "battery_mah": phone.battery_mah,
            "ram_gb": phone.ram_gb,
            "memory_gb": phone.memory_gb,
            "back_camera_mp": phone.back_camera_mp,
            "user_rating": phone.user_rating,
            "processor": phone.processor,
            "screen_size": phone.screen_size
        })
    
    if len(phone_data) < 2:
        return {"error": "Not enough valid phones found"}
    
    # Determine winners for each category
    best_camera = max(phone_data, key=lambda x: x['back_camera_mp'] or 0)
    best_battery = max(phone_data, key=lambda x: x['battery_mah'] or 0)
    best_value = min(phone_data, key=lambda x: (x['price_inr'] or float('inf')) / max(x['user_rating'] or 1, 1))
    best_rating = max(phone_data, key=lambda x: x['user_rating'] or 0)
    
    return {
        "phones": phone_data,
        "winners": {
            "camera": best_camera['phone_id'],
            "battery": best_battery['phone_id'],
            "value": best_value['phone_id'],
            "overall": best_rating['phone_id']
        }
    }


@tool
def get_recommendations(
    use_case: Annotated[str, "Use case: gaming, camera, battery, budget, premium"],
    max_budget: Annotated[Optional[int], "Maximum budget in INR"] = None,
    min_budget: Annotated[Optional[int], "Minimum budget in INR"] = None,
    limit: Annotated[int, "Number of recommendations"] = 5
) -> list[dict]:
    """
    Get phone recommendations based on use case.
    Returns phones that ACTUALLY match the criteria from database.
    """
    queryset = Phone.objects.all()
    
    # Apply budget filters
    if min_budget:
        queryset = queryset.filter(price_inr__gte=min_budget)
    if max_budget:
        queryset = queryset.filter(price_inr__lte=max_budget)
    
    # Sort based on use case
    use_case_lower = use_case.lower()
    
    if 'gaming' in use_case_lower or 'performance' in use_case_lower:
        queryset = queryset.order_by('-performance_rating', '-ram_gb', '-user_rating')
    
    elif 'camera' in use_case_lower or 'photo' in use_case_lower:
        queryset = queryset.order_by('-camera_rating', '-back_camera_mp', '-user_rating')
    
    elif 'battery' in use_case_lower:
        queryset = queryset.order_by('-battery_mah', '-battery_rating', '-user_rating')
    
    elif 'budget' in use_case_lower or 'cheap' in use_case_lower:
        queryset = queryset.order_by('price_inr', '-user_rating')
    
    elif 'premium' in use_case_lower or 'flagship' in use_case_lower:
        queryset = queryset.order_by('-price_inr', '-user_rating')
    
    else:
        # Default: best rated
        queryset = queryset.order_by('-user_rating', '-price_inr')
    
    phones = queryset[:limit]
    
    return [
        {
            "phone_id": p.id,
            "company_name": p.company_name,
            "model_name": p.model_name,
            "price_inr": p.price_inr,
            "battery_mah": p.battery_mah,
            "ram_gb": p.ram_gb,
            "back_camera_mp": p.back_camera_mp,
            "user_rating": p.user_rating,
            "relevance_reason": f"Great for {use_case}"
        }
        for p in phones
    ]


@tool
def get_available_brands() -> list[str]:
    """
    Get list of all available phone brands in database.
    Use this to validate brand names.
    """
    brands = Phone.objects.values_list('company_name', flat=True).distinct()
    return sorted(set(b.lower() for b in brands if b))


@tool
def get_price_range() -> dict:
    """
    Get the price range of phones in database.
    Use this to validate price expectations.
    """
    from django.db.models import Min, Max
    
    stats = Phone.objects.aggregate(
        min_price=Min('price_inr'),
        max_price=Max('price_inr')
    )
    
    return {
        "min_price": stats['min_price'] or 0,
        "max_price": stats['max_price'] or 0,
        "currency": "INR"
    }


@tool
def answer_general_question(
    question: Annotated[str, "The general technology or mobile phone question to answer"]
) -> str:
    """
    Answer general questions about mobile phones and technology.
    Use this for questions that don't require database lookups, like:
    - What is 5G?
    - How does wireless charging work?
    - What's the difference between AMOLED and LCD?
    - What is IP68 rating?
    
    DO NOT use this for questions about specific phones or recommendations.
    """
    # This tool signals to the LLM that it should answer from general knowledge
    # The actual response is generated by the LLM based on this tool's description
    return f"Please provide a helpful, accurate answer about: {question}"


# Export all tools
MOBIADVISOR_TOOLS = [
    search_phones,
    get_phone_details,
    compare_phones,
    get_recommendations,
    get_available_brands,
    get_price_range,
    answer_general_question
]

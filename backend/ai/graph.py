"""
LangGraph agent for MobiAdvisor.
Implements a graph-based workflow with anti-hallucination nodes.
"""

import os
from typing import TypedDict, Annotated, Sequence, Optional
from operator import add

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

from django.conf import settings

from .tools import MOBIADVISOR_TOOLS
from .guardrails import input_guardrail, output_guardrail, fact_checker
from .schemas import SearchIntent, GroundedResponse


# System prompt emphasizing insightful, conversational responses
SYSTEM_PROMPT = """You are MobiAdvisor, an expert AI mobile phone shopping assistant for India.

## YOUR PERSONALITY
- Friendly, knowledgeable, and conversational like a tech-savvy friend
- Provide INSIGHTS and ANALYSIS, not just specs
- Help users understand WHY a phone is good for them

## HANDLING MULTIPLE QUERIES
When user asks multiple questions in one message:
1. Address EACH question separately in your response
2. Use numbered sections or headers for clarity
3. Make multiple tool calls if needed (one for each distinct query)
4. Example: "Best phone for gaming and what is 5G?" → Use search_phones AND answer_general_question

## GENERAL QUESTIONS (Tech/Knowledge)
For questions that DON'T need database lookups:
- Use the answer_general_question tool
- Topics: 5G, wireless charging, IP ratings, AMOLED vs LCD, etc.
- Provide accurate, concise explanations
- Keep responses educational but brief

## RESPONSE STRUCTURE
When recommending phones, ALWAYS include:

1. **Opening Summary** (1-2 sentences):
   - Directly answer the user's question
   - Mention the TOP recommendation upfront

2. **For Each Phone** (in order of recommendation):
   - 🏆 **[Brand Model]** - ₹XX,XXX
   - ⭐ **Why It's Great**: 2-3 sentences on standout features
   - ✅ **Pros**: 3-4 bullet points
   - ⚠️ **Consider**: 1-2 limitations (if any)
   - 💡 **Best For**: Gaming / Photography / Daily Use

3. **Quick Verdict** (at the end):
   - Your top pick and why
   - Alternative if budget is flexible

## INSIGHTS TO PROVIDE (beyond specs)
- How the processor handles gaming/multitasking
- Camera quality in real-world conditions
- Battery life for typical usage
- Value for money compared to competitors

## COMPARISON RESPONSES
When comparing phones:
- Declare overall winner upfront
- Category winners: Camera, Battery, Performance, Value
- Final recommendation based on user's needs

## FOLLOW-UP QUERIES
Handle conversation context:
- "Tell me more about the first one" → Reference previous results
- "Compare them" → Use compare_phones with IDs from context
- "What about cheaper options?" → Search with new price constraints

## CRITICAL RULES
1. ONLY use data from tool results - NEVER invent specs
2. Include Phone ID for reference: (ID: XX)
3. Prices in ₹ format with commas (₹79,999)
4. If unsure, say so - honesty builds trust
5. Use appropriate tools for each type of question
6. For multiple questions, answer ALL of them

## AVOID
- Listing raw specs without context
- Ignoring parts of multi-part questions
- Overwhelming users with too many options (max 5 phones)
- Marketing language - be authentic"""


class AgentState(TypedDict):
    """State for the LangGraph agent."""
    messages: Annotated[Sequence[BaseMessage], add]
    phones: list[dict]  # Phones retrieved from database
    input_valid: bool
    error: Optional[str]
    response_validated: bool


def create_llm():
    """Create LLM instance with settings."""
    api_key = getattr(settings, 'OPENAI_API_KEY', '') or os.getenv('OPENAI_API_KEY', '')
    model = getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini')
    
    return ChatOpenAI(
        api_key=api_key,
        model=model,
        temperature=0.4,  # Slightly higher for more natural responses
        max_tokens=2048   # Increased for detailed insights
    )


def input_validation_node(state: AgentState) -> dict:
    """
    Node: Validate user input.
    Prevents prompt injection and off-topic queries.
    """
    messages = state.get('messages', [])
    if not messages:
        return {"input_valid": False, "error": "No input provided"}
    
    last_message = messages[-1]
    if not isinstance(last_message, HumanMessage):
        return {"input_valid": True}
    
    query = last_message.content
    is_valid, error = input_guardrail.validate(query)
    
    if not is_valid:
        return {
            "input_valid": False,
            "error": error,
            "messages": [AIMessage(content=error)]
        }
    
    return {"input_valid": True}


def agent_node(state: AgentState) -> dict:
    """
    Node: Main agent that uses tools.
    Bound to tools and instructed to ground all responses.
    """
    if not state.get('input_valid', True):
        return {}
    
    llm = create_llm()
    llm_with_tools = llm.bind_tools(MOBIADVISOR_TOOLS)
    
    # Add system prompt
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(state.get('messages', []))
    
    response = llm_with_tools.invoke(messages)
    
    return {"messages": [response]}


def should_use_tools(state: AgentState) -> str:
    """
    Edge: Determine if we need to call tools.
    """
    messages = state.get('messages', [])
    if not messages:
        return "respond"
    
    last_message = messages[-1]
    
    # Check if the last message has tool calls
    if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
        return "tools"
    
    return "respond"


def output_validation_node(state: AgentState) -> dict:
    """
    Node: Validate LLM output.
    Ensures response is grounded in database data.
    """
    messages = state.get('messages', [])
    if not messages:
        return {"response_validated": True}
    
    last_message = messages[-1]
    if not isinstance(last_message, AIMessage):
        return {"response_validated": True}
    
    content = last_message.content
    phones = state.get('phones', [])
    
    # If we have phones from tools, validate response references them
    if phones:
        phone_ids = [p.get('phone_id') or p.get('id') for p in phones]
        all_valid, valid_ids = output_guardrail.validate_phone_ids(phone_ids)
        
        if not all_valid:
            # Some phone IDs were not found - potential hallucination
            return {
                "response_validated": False,
                "error": "Response references invalid phones"
            }
    
    return {"response_validated": True}


def response_node(state: AgentState) -> dict:
    """
    Node: Generate final response.
    Only called when no more tools needed.
    """
    if not state.get('response_validated', True):
        # Validation failed - add disclaimer
        return {
            "messages": [AIMessage(content="I apologize, but I couldn't verify some information. Please try a more specific query.")]
        }
    
    return {}


def extract_phones_from_tools(state: AgentState) -> dict:
    """
    Extract phone data from tool results.
    Called after tools execute.
    """
    messages = state.get('messages', [])
    phones = []
    
    for msg in messages:
        if hasattr(msg, 'content') and isinstance(msg.content, str):
            try:
                import json
                content = json.loads(msg.content)
                if isinstance(content, list):
                    phones.extend(content)
                elif isinstance(content, dict) and 'phones' in content:
                    phones.extend(content['phones'])
            except (json.JSONDecodeError, TypeError):
                pass
    
    return {"phones": phones}


def create_mobiadvisor_graph():
    """
    Create the LangGraph for MobiAdvisor.
    
    Graph structure:
    input_validation -> agent -> tools (loop) -> output_validation -> response
    """
    # Create tool node
    tool_node = ToolNode(MOBIADVISOR_TOOLS)
    
    # Build graph
    graph = StateGraph(AgentState)
    
    # Add nodes
    graph.add_node("input_validation", input_validation_node)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.add_node("extract_phones", extract_phones_from_tools)
    graph.add_node("output_validation", output_validation_node)
    graph.add_node("respond", response_node)
    
    # Set entry point
    graph.set_entry_point("input_validation")
    
    # Add edges
    graph.add_edge("input_validation", "agent")
    
    # Conditional: agent decides to use tools or respond
    graph.add_conditional_edges(
        "agent",
        should_use_tools,
        {
            "tools": "tools",
            "respond": "output_validation"
        }
    )
    
    # After tools, extract phones and go back to agent
    graph.add_edge("tools", "extract_phones")
    graph.add_edge("extract_phones", "agent")
    
    # Validation before final response
    graph.add_edge("output_validation", "respond")
    graph.add_edge("respond", END)
    
    return graph.compile()


# Singleton agent instance
_agent = None


def get_mobiadvisor_agent():
    """Get or create the MobiAdvisor agent."""
    global _agent
    if _agent is None:
        _agent = create_mobiadvisor_graph()
    return _agent


async def run_agent_async(query: str, history: list[dict] = None) -> dict:
    """
    Run the agent asynchronously.
    
    Args:
        query: User's question
        history: Previous conversation messages
        
    Returns:
        Dict with response, phones, and metadata
    """
    agent = get_mobiadvisor_agent()
    
    # Build messages
    messages = []
    if history:
        for msg in history:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if role == 'user':
                messages.append(HumanMessage(content=content))
            else:
                messages.append(AIMessage(content=content))
    
    messages.append(HumanMessage(content=query))
    
    # Run agent
    result = await agent.ainvoke({
        "messages": messages,
        "phones": [],
        "input_valid": True,
        "error": None,
        "response_validated": True
    })
    
    # Extract response
    final_messages = result.get('messages', [])
    response_content = ""
    for msg in reversed(final_messages):
        if isinstance(msg, AIMessage) and msg.content:
            response_content = msg.content
            break
    
    return {
        "response": response_content,
        "phones": result.get('phones', []),
        "validated": result.get('response_validated', True),
        "error": result.get('error')
    }


def run_agent_sync(query: str, history: list[dict] = None) -> dict:
    """
    Run the agent synchronously.
    Injects phone context from previous messages for better follow-up handling.
    """
    agent = get_mobiadvisor_agent()
    
    # Build messages with phone context
    messages = []
    context_phones = []  # Track phones mentioned in conversation
    
    if history:
        for msg in history:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            phones = msg.get('phones', [])
            
            if role == 'user':
                messages.append(HumanMessage(content=content))
            else:
                # For assistant messages, inject phone context if available
                if phones and isinstance(phones, list) and len(phones) > 0:
                    # Build phone context summary
                    phone_context = "\n\n[CONTEXT - Previously mentioned phones:\n"
                    for i, phone in enumerate(phones[:5], 1):  # Limit to 5 phones
                        if isinstance(phone, dict):
                            name = f"{phone.get('company_name', '')} {phone.get('model_name', '')}"
                            phone_id = phone.get('id', 'N/A')
                            price = phone.get('price_inr', 0)
                            phone_context += f"  {i}. {name} (ID: {phone_id}, ₹{price:,})\n"
                            context_phones.append(phone)
                    phone_context += "]"
                    content_with_context = content + phone_context
                    messages.append(AIMessage(content=content_with_context))
                else:
                    messages.append(AIMessage(content=content))
    
    # Check if this is a follow-up query and inject context reminder
    query_lower = query.lower()
    follow_up_patterns = ['first one', 'second one', 'third one', 'this one', 'that one',
                          'tell me more', 'more about', 'which one', 'compare them',
                          'best one', 'the one', 'it has', 'does it', 'is it']
    
    is_follow_up = any(pattern in query_lower for pattern in follow_up_patterns)
    
    if is_follow_up and context_phones:
        # Inject a context reminder before the user query
        context_reminder = "CONTEXT REMINDER - The user is referring to these previously discussed phones:\n"
        for i, phone in enumerate(context_phones[:5], 1):
            if isinstance(phone, dict):
                name = f"{phone.get('company_name', '')} {phone.get('model_name', '')}"
                phone_id = phone.get('id', 'N/A')
                price = phone.get('price_inr', 0)
                ram = phone.get('ram_gb', 'N/A')
                storage = phone.get('memory_gb', 'N/A')
                battery = phone.get('battery_mah', 'N/A')
                camera = phone.get('back_camera_mp', 'N/A')
                context_reminder += f"  {i}. {name} (ID: {phone_id}) - ₹{price:,}, {ram}GB RAM, {storage}GB storage, {battery}mAh battery, {camera}MP camera\n"
        
        # Add context as system-like message
        messages.append(AIMessage(content=context_reminder))
    
    messages.append(HumanMessage(content=query))
    
    # Run agent
    result = agent.invoke({
        "messages": messages,
        "phones": context_phones,  # Pass context phones to state
        "input_valid": True,
        "error": None,
        "response_validated": True
    })
    
    # Extract response
    final_messages = result.get('messages', [])
    response_content = ""
    phones = []
    
    for msg in reversed(final_messages):
        if isinstance(msg, AIMessage) and msg.content:
            # Clean up any context markers from response
            response_content = msg.content
            # Remove context injection artifacts if present
            if "[CONTEXT -" in response_content:
                response_content = response_content.split("[CONTEXT -")[0].strip()
            break
    
    return {
        "response": response_content,
        "phones": result.get('phones', []),
        "validated": result.get('response_validated', True),
        "error": result.get('error')
    }

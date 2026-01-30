import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Phone } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CompareRequest {
    phones: Phone[];
}

interface CategoryWinner {
    winner: string;
    reasoning: string;
}

interface CompareAnalysis {
    overall: CategoryWinner;
    gaming: CategoryWinner;
    photography: CategoryWinner;
    value: CategoryWinner;
    dailyUse: CategoryWinner;
    summary: string;
}

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'OpenAI API key not configured' },
                { status: 500 }
            );
        }

        const openai = new OpenAI({ apiKey });
        const body: CompareRequest = await request.json();
        const { phones } = body;

        if (!phones || phones.length < 2) {
            return NextResponse.json(
                { error: 'At least 2 phones required for comparison' },
                { status: 400 }
            );
        }

        // Build phone specs string for LLM
        const phoneSpecs = phones.map(p => `
**${p.company_name} ${p.model_name}**
- Price: ₹${p.price_inr.toLocaleString('en-IN')}
- Rating: ${p.user_rating}/5
- Battery: ${p.battery_mah}mAh
- Rear Camera: ${p.back_camera_mp}MP
- Front Camera: ${p.front_camera_mp}MP
- RAM: ${p.ram_gb}GB
- Storage: ${p.memory_gb}GB
- Screen: ${p.screen_size}"
- Processor: ${p.processor}
`).join('\n');

        const prompt = `You are a phone comparison expert. Analyze these phones and determine the best option for different use cases.

PHONES TO COMPARE:
${phoneSpecs}

Analyze and provide winners for each category. Be specific about WHY each phone wins its category. Base your analysis ONLY on the provided specifications.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
    "overall": {
        "winner": "Brand Model",
        "reasoning": "2-3 sentence explanation of why this is the overall winner"
    },
    "gaming": {
        "winner": "Brand Model",
        "reasoning": "Explain based on RAM, processor, screen"
    },
    "photography": {
        "winner": "Brand Model", 
        "reasoning": "Explain based on camera specs"
    },
    "value": {
        "winner": "Brand Model",
        "reasoning": "Explain price-to-feature ratio"
    },
    "dailyUse": {
        "winner": "Brand Model",
        "reasoning": "Explain based on battery, rating, reliability"
    },
    "summary": "A brief 2-3 sentence overall summary of the comparison"
}

IMPORTANT: 
- Only use the exact phone names provided above
- Be objective and base analysis on actual specs
- Don't make up features not listed
- Respond with ONLY the JSON object, nothing else`;

        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a phone comparison expert. Respond only with valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' }
        });

        const text = response.choices[0]?.message?.content || '';

        // Parse JSON from response
        const analysis: CompareAnalysis = JSON.parse(text);

        return NextResponse.json({
            success: true,
            analysis,
        });
    } catch (error) {
        console.error('Compare API error:', error);
        return NextResponse.json(
            { error: 'Failed to analyze phones', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

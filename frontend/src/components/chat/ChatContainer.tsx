'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage as ChatMessageType, ChatHistoryMessage, Phone } from 'types';
import { cn } from 'lib/utils';
import { Sparkles, MessageCircle, Loader2, Search, Database, Brain, Trash2 } from 'lucide-react';
import { sendChatMessage } from 'api/client';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { Button } from 'components/ui';

interface ChatContainerProps {
    comparePhones: Phone[];
    onAddToCompare: (phone: Phone) => void;
    onRemoveFromCompare: (phoneId: number) => void;
    darkMode?: boolean;
}

const WELCOME_MESSAGE: ChatMessageType = {
    id: 'welcome',
    role: 'assistant',
    content: `👋 **Welcome to MobiAdvisor!**

I'm your AI-powered phone shopping assistant. I can help you:
- 🔍 **Find phones** matching your requirements
- ⚖️ **Compare** different phone models
- 💡 **Get recommendations** based on your needs
- 📱 **Answer questions** about phone features

**Try asking:**
- "Best phone under 30k for gaming"
- "Compare Samsung S24 and iPhone 15"
- "Show me phones with best camera"`,
    timestamp: new Date(),
    status: 'complete',
};

const SUGGESTION_CARDS = [
    { text: 'Best phone under 25k', icon: '💰' },
    { text: 'Compare Samsung vs iPhone', icon: '⚖️' },
    { text: 'Best camera phones', icon: '📷' },
    { text: 'Gaming phones in 2024', icon: '🎮' },
];

// Loading status messages to show progress
const LOADING_STAGES = [
    { text: 'Analyzing your query...', icon: Search, duration: 1500 },
    { text: 'Searching phone database...', icon: Database, duration: 2000 },
    { text: 'Generating insights...', icon: Brain, duration: 3000 },
];

// Local storage key for chat history
const STORAGE_KEY = 'mobiadvisor_chat_history';

export default function ChatContainer({
    comparePhones,
    onAddToCompare,
    onRemoveFromCompare,
    darkMode = false,
}: ChatContainerProps) {
    // Load initial messages from localStorage
    const loadSavedMessages = (): ChatMessageType[] => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Convert timestamps back to Date objects
                return parsed.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
            }
        } catch (e) {
            console.error('Failed to load chat history:', e);
        }
        return [WELCOME_MESSAGE];
    };

    const [messages, setMessages] = useState<ChatMessageType[]>(loadSavedMessages);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStage, setLoadingStage] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Save messages to localStorage whenever they change
    useEffect(() => {
        try {
            // Filter out processing messages before saving
            const toSave = messages.filter(m => m.status !== 'processing' && m.status !== 'pending');
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {
            console.error('Failed to save chat history:', e);
        }
    }, [messages]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Cycle through loading stages
    useEffect(() => {
        if (!isLoading) {
            setLoadingStage(0);
            return;
        }

        let currentStage = 0;
        const advanceStage = () => {
            if (currentStage < LOADING_STAGES.length - 1) {
                currentStage++;
                setLoadingStage(currentStage);
            }
        };

        // Advance through stages
        const timer1 = setTimeout(advanceStage, LOADING_STAGES[0].duration);
        const timer2 = setTimeout(advanceStage, LOADING_STAGES[0].duration + LOADING_STAGES[1].duration);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [isLoading]);

    const handleSend = async (content: string) => {
        // Add user message
        const userMessage: ChatMessageType = {
            id: `user-${Date.now()}`,
            role: 'user',
            content,
            timestamp: new Date(),
            status: 'complete',
        };

        // Add processing indicator
        const processingMessage: ChatMessageType = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: LOADING_STAGES[0].text,
            timestamp: new Date(),
            status: 'processing',
        };

        setMessages((prev) => [...prev, userMessage, processingMessage]);
        setIsLoading(true);
        setLoadingStage(0);

        try {
            // Build conversation history
            const history: ChatHistoryMessage[] = messages
                .filter((m) => m.id !== 'welcome')
                .slice(-10)
                .map((m) => ({
                    role: m.role,
                    content: m.content,
                    phones: m.phones,
                }));

            // Send to API
            const response = await sendChatMessage(content, history);

            // Update with response
            setMessages((prev) => {
                const updated = [...prev];
                const lastIndex = updated.findIndex((m) => m.id === processingMessage.id);
                if (lastIndex !== -1) {
                    updated[lastIndex] = {
                        ...processingMessage,
                        content: response.message,
                        phones: response.phones,
                        status: 'complete',
                    };
                }
                return updated;
            });
        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => {
                const updated = [...prev];
                const lastIndex = updated.findIndex((m) => m.id === processingMessage.id);
                if (lastIndex !== -1) {
                    updated[lastIndex] = {
                        ...processingMessage,
                        content: 'Sorry, something went wrong. Please try again.',
                        status: 'error',
                    };
                }
                return updated;
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Toggle compare - adds if not in list, removes if already in list
    const handleCompareToggle = (phoneId: number) => {
        const isInCompare = comparePhones.some((p) => p.id === phoneId);

        if (isInCompare) {
            // Remove from compare
            onRemoveFromCompare(phoneId);
        } else {
            // Find the phone in messages and add to compare
            for (const message of messages) {
                const phone = message.phones?.find((p) => p.id === phoneId);
                if (phone) {
                    onAddToCompare(phone);
                    break;
                }
            }
        }
    };

    const handleClearHistory = () => {
        setMessages([WELCOME_MESSAGE]);
        localStorage.removeItem(STORAGE_KEY);
    };

    const comparePhoneIds = comparePhones.map((p) => p.id);
    const currentLoadingStage = LOADING_STAGES[loadingStage];

    return (
        <div className={cn('flex flex-col h-full', darkMode ? 'bg-gray-900' : 'bg-gray-50')}>
            {/* Header with clear button */}
            {messages.length > 1 && (
                <div className={cn(
                    'flex-shrink-0 px-4 py-2 border-b flex justify-end',
                    darkMode ? 'border-gray-700' : 'border-gray-200'
                )}>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearHistory}
                        className={cn(
                            'text-xs',
                            darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                        )}
                    >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Clear Chat
                    </Button>
                </div>
            )}

            {/* Messages - scrollable area */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {messages.map((message) => (
                    <ChatMessage
                        key={message.id}
                        message={message}
                        onCompare={handleCompareToggle}
                        darkMode={darkMode}
                        comparePhoneIds={comparePhoneIds}
                        loadingStage={message.status === 'processing' ? currentLoadingStage : undefined}
                    />
                ))}
                <div ref={messagesEndRef} />

                {/* Suggestion cards (show only after welcome) */}
                {messages.length === 1 && (
                    <div className="p-4 grid grid-cols-2 gap-2">
                        {SUGGESTION_CARDS.map((card) => (
                            <button
                                key={card.text}
                                onClick={() => handleSend(card.text)}
                                disabled={isLoading}
                                className={cn(
                                    'p-3 rounded-xl border text-left transition-all',
                                    'hover:shadow-md hover:border-violet-400',
                                    darkMode
                                        ? 'bg-gray-800 border-gray-700 text-gray-200'
                                        : 'bg-white border-gray-200 text-gray-700'
                                )}
                            >
                                <span className="text-lg mr-2">{card.icon}</span>
                                <span className="text-sm">{card.text}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Input - fixed at bottom */}
            <div className={cn('flex-shrink-0 p-4 border-t', darkMode ? 'border-gray-700' : 'border-gray-200')}>
                <ChatInput
                    onSend={handleSend}
                    disabled={isLoading}
                    darkMode={darkMode}
                />
            </div>
        </div>
    );
}

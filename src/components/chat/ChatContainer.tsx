'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Phone, ChatMessage as ChatMessageType, ChatHistoryMessage } from '@/types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { Zap, TrendingUp, Camera, Battery, Scale, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ChatContainerProps {
    onAddToCompare?: (phone: Phone) => void;
    darkMode?: boolean;
}

const SUGGESTIONS = [
    { icon: Zap, text: 'Best phone under 30k', color: 'from-amber-500 to-orange-500' },
    { icon: TrendingUp, text: 'Compare iPhone vs Samsung', color: 'from-blue-500 to-indigo-500' },
    { icon: Camera, text: 'Best camera phone', color: 'from-pink-500 to-rose-500' },
    { icon: Battery, text: 'Best battery phone', color: 'from-green-500 to-emerald-500' },
];

export default function ChatContainer({ onAddToCompare, darkMode = false }: ChatContainerProps) {
    const [messages, setMessages] = useState<ChatMessageType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const shouldAutoScroll = useRef(true);

    // Check if user is near bottom of chat (within 150px)
    const checkIfNearBottom = () => {
        const container = messagesContainerRef.current;
        if (!container) return true;
        const threshold = 150;
        return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    };

    // Handle scroll - track if user scrolled up to read older messages
    const handleScroll = () => {
        shouldAutoScroll.current = checkIfNearBottom();
    };

    const scrollToBottom = (immediate = false) => {
        if (!shouldAutoScroll.current && !immediate) return;
        // Small delay to ensure content is rendered
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 50);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (content: string) => {
        if (!content.trim() || isLoading) return;

        // Reset auto-scroll when user sends a new message
        shouldAutoScroll.current = true;

        const userMessage: ChatMessageType = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date(),
            status: 'complete'
        };

        const assistantMessageId = (Date.now() + 1).toString();
        const assistantMessage: ChatMessageType = {
            id: assistantMessageId,
            role: 'assistant',
            content: 'Understanding your query...',
            timestamp: new Date(),
            status: 'processing'
        };

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setIsLoading(true);

        // Status cycling to show progress
        const statusMessages = [
            'Understanding your query...',
            'Searching phones...',
            'Finding best matches...',
            'Generating response...'
        ];
        let statusIndex = 0;
        const statusInterval = setInterval(() => {
            statusIndex = (statusIndex + 1) % statusMessages.length;
            setMessages(prev => prev.map(m =>
                m.id === assistantMessageId && m.status === 'processing'
                    ? { ...m, content: statusMessages[statusIndex] }
                    : m
            ));
        }, 3000);

        try {
            // Build history from previous messages
            const history: ChatHistoryMessage[] = messages.slice(-10).map(m => ({
                role: m.role,
                content: m.content,
                phones: m.phones
            }));

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: content, history })
            });

            clearInterval(statusInterval);
            const data = await response.json();

            setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                    ? {
                        ...m,
                        content: data.message || 'Sorry, I encountered an error.',
                        phones: data.phones || [],
                        status: 'complete' as const
                    }
                    : m
            ));
        } catch (error) {
            clearInterval(statusInterval);
            console.error('Chat error:', error);
            setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                    ? {
                        ...m,
                        content: 'Sorry, something went wrong. Please try again.',
                        status: 'error' as const
                    }
                    : m
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompare = (phoneId: number) => {
        const phone = messages
            .flatMap(m => m.phones || [])
            .find(p => p.id === phoneId);
        if (phone && onAddToCompare) {
            onAddToCompare(phone);
        }
    };

    const handleClearChat = () => {
        setMessages([]);
    };

    return (
        <div className={cn("flex flex-col h-full", darkMode ? "bg-gray-900" : "bg-white")}>
            {/* Header with Clear Chat */}
            {messages.length > 0 && (
                <div className={cn("flex justify-end p-3 border-b", darkMode ? "border-gray-700" : "border-gray-100")}>
                    <button
                        onClick={handleClearChat}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors",
                            darkMode ? "text-gray-400 hover:text-red-400 hover:bg-red-900/30" : "text-gray-500 hover:text-red-500 hover:bg-red-50"
                        )}
                    >
                        <Trash2 className="w-4 h-4" />
                        Clear Chat
                    </button>
                </div>
            )}
            {/* Messages Area */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto"
            >
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8">
                        {/* Welcome */}
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
                            <Scale className="w-8 h-8 text-white" />
                        </div>
                        <h2 className={cn("text-2xl font-bold mb-2", darkMode ? "text-white" : "text-gray-900")}>MobiAdvisor</h2>
                        <p className={cn("text-center max-w-md mb-8", darkMode ? "text-gray-400" : "text-gray-500")}>
                            Your AI-powered phone shopping assistant. Ask me anything about phones!
                        </p>

                        {/* Suggestion Cards */}
                        <div className="grid grid-cols-2 gap-3 max-w-lg">
                            {SUGGESTIONS.map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(suggestion.text)}
                                    className={cn(
                                        "flex items-center gap-3 p-4 rounded-xl transition-all group border",
                                        darkMode ? "bg-gray-800 hover:bg-gray-700 border-gray-700" : "bg-gray-50 hover:bg-gray-100 border-gray-100"
                                    )}
                                >
                                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${suggestion.color} flex items-center justify-center`}>
                                        <suggestion.icon className="w-5 h-5 text-white" />
                                    </div>
                                    <span className={cn("text-sm font-medium text-left", darkMode ? "text-gray-200" : "text-gray-700")}>
                                        {suggestion.text}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="py-4">
                        {messages.map(message => (
                            <ChatMessage
                                key={message.id}
                                message={message}
                                onCompare={handleCompare}
                                darkMode={darkMode}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className={cn("border-t p-4", darkMode ? "border-gray-700 bg-gray-800" : "border-gray-100 bg-gray-50")}>
                <ChatInput onSend={handleSend} disabled={isLoading} darkMode={darkMode} />
            </div>
        </div>
    );
}

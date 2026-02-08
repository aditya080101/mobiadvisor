'use client';

import React from 'react';
import DOMPurify from 'dompurify';
import type { ChatMessage as ChatMessageType, Phone } from 'types';
import { cn } from 'lib/utils';
import { Bot, User, Loader2 } from 'lucide-react';
import PhoneCard from 'components/phone/PhoneCard';

interface LoadingStage {
    text: string;
    icon: React.ElementType;
    duration: number;
}

interface ChatMessageProps {
    message: ChatMessageType;
    onCompare?: (phoneId: number) => void;
    darkMode?: boolean;
    comparePhoneIds?: number[];
    loadingStage?: LoadingStage;
}

export default function ChatMessage({ message, onCompare, darkMode = false, comparePhoneIds = [], loadingStage }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const isLoading = message.status === 'processing' || message.status === 'pending';

    return (
        <div
            className={cn(
                'flex gap-3 p-4',
                isUser ? 'flex-row-reverse' : 'flex-row'
            )}
        >
            {/* Avatar */}
            <div
                className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                    isUser
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                )}
            >
                {isUser ? (
                    <User className="w-4 h-4 text-white" />
                ) : (
                    <Bot className="w-4 h-4 text-white" />
                )}
            </div>

            {/* Message Content */}
            <div
                className={cn(
                    'flex-1 max-w-[80%]',
                    isUser ? 'text-right' : 'text-left'
                )}
            >
                <div
                    className={cn(
                        'inline-block rounded-2xl px-4 py-3',
                        isUser
                            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white'
                            : darkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900'
                    )}
                >
                    {isLoading ? (
                        <div className="flex items-center gap-3 py-2">
                            {loadingStage ? (
                                <>
                                    <loadingStage.icon className="w-5 h-5 text-violet-500 animate-pulse" />
                                    <span className={cn(
                                        'text-sm font-medium',
                                        darkMode ? 'text-violet-300' : 'text-violet-600'
                                    )}>
                                        {loadingStage.text}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-1">
                                        <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                    <span className="text-sm text-gray-500">{message.content || 'Processing...'}</span>
                                </>
                            )}
                        </div>
                    ) : (
                        <div
                            className={cn(
                                "prose prose-sm max-w-none",
                                darkMode && "prose-invert"
                            )}
                            dangerouslySetInnerHTML={{
                                __html: formatMarkdown(message.content)
                            }}
                        />
                    )}
                </div>

                {/* Phone Results */}
                {message.phones && message.phones.length > 0 && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {message.phones.map((phone) => (
                            <PhoneCard
                                key={phone.id}
                                phone={phone}
                                onCompare={onCompare}
                                darkMode={darkMode}
                                isInCompare={comparePhoneIds.includes(phone.id)}
                                compact
                            />
                        ))}
                    </div>
                )}

                {/* Timestamp */}
                <div
                    className={cn(
                        'text-xs mt-1',
                        darkMode ? 'text-gray-500' : 'text-gray-400',
                        isUser ? 'text-right' : 'text-left'
                    )}
                    suppressHydrationWarning
                >
                    {formatTime(message.timestamp)}
                </div>
            </div>
        </div>
    );
}

function formatMarkdown(text: string): string {
    if (!text) return '';

    let result = text;

    // Code blocks
    result = result.replace(/```(\w*)\n([\s\S]*?)```/g,
        '<pre class="bg-gray-800 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-sm"><code>$2</code></pre>');

    // Inline code
    result = result.replace(/`([^`]+)`/g,
        '<code class="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

    // Bold
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-violet-600 hover:underline">$1</a>');

    // Headers
    result = result.replace(/^### (.+)$/gm, '<h4 class="font-semibold mt-2 mb-1">$1</h4>');
    result = result.replace(/^## (.+)$/gm, '<h3 class="font-bold mt-3 mb-1 text-lg">$1</h3>');
    result = result.replace(/^# (.+)$/gm, '<h2 class="font-bold mt-4 mb-2 text-xl">$1</h2>');

    // Numbered lists
    result = result.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="flex gap-2 my-2 ml-2"><span class="font-bold text-violet-600 min-w-[20px]">$1.</span><strong>$2</strong></div>');

    // Bullet lists
    result = result.replace(/^[\s]*[-•*]\s+(.+)$/gm, '<li class="ml-8 pl-2">$1</li>');
    result = result.replace(/((?:<li class="[^"]*">.*?<\/li>\s*)+)/g, '<ul class="my-1 list-disc space-y-0.5">$1</ul>');

    // Line breaks
    result = result.replace(/\n(?!<)/g, '<br />');

    // Price formatting
    result = result.replace(/(₹[\d,]+)/g, '<span class="font-semibold text-emerald-600">$1</span>');

    // Sanitize
    return DOMPurify.sanitize(result, {
        ALLOWED_TAGS: ['strong', 'em', 'a', 'code', 'pre', 'h2', 'h3', 'h4', 'li', 'ul', 'ol', 'br', 'span', 'div'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style']
    });
}

function formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

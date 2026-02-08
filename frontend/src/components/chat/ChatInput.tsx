'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { cn } from 'lib/utils';
import { Button } from 'components/ui';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    darkMode?: boolean;
    placeholder?: string;
}

export default function ChatInput({
    onSend,
    disabled = false,
    darkMode = false,
    placeholder = 'Ask about phones...',
}: ChatInputProps) {
    const [input, setInput] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (input.trim() && !disabled) {
            onSend(input.trim());
            setInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    return (
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <div className="flex-1 relative">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={1}
                    className={cn(
                        'w-full px-4 py-3 pr-12 rounded-xl border resize-none',
                        'focus:outline-none focus:ring-2 focus:ring-violet-500',
                        'transition-colors',
                        darkMode
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500',
                        disabled && 'opacity-50 cursor-not-allowed'
                    )}
                />
            </div>
            <Button
                type="submit"
                disabled={disabled || !input.trim()}
                className="h-12 w-12 shrink-0"
                size="icon"
            >
                <Send className="w-5 h-5" />
            </Button>
        </form>
    );
}

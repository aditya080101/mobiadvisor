'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  darkMode?: boolean;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Ask anything about phones...",
  darkMode = false
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={cn(
      "px-2 md:px-4 py-2 w-full",
      darkMode ? "bg-gray-900" : "bg-[#FFFDF8]"
    )}>
      {/* Input Form - centered with max-width */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-center max-w-3xl mx-auto">
        <div className={cn(
          "flex-1 relative rounded-full shadow-md",
          darkMode ? "shadow-gray-900/50" : "shadow-gray-200/80"
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full resize-none rounded-full border-2 px-4 py-3 text-sm md:text-base',
              'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
              'placeholder:text-gray-400 transition-all',
              darkMode
                ? 'bg-gray-800 border-gray-600 text-white focus:bg-gray-700'
                : 'bg-white border-gray-300 focus:bg-white',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          />
        </div>

        <Button
          type="submit"
          disabled={disabled || !input.trim()}
          className={cn(
            "h-10 w-10 md:h-9 md:w-9 rounded-full shadow-md transition-all duration-200 flex-shrink-0",
            "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700",
            "disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed",
            "flex items-center justify-center"
          )}
        >
          {disabled ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Send className="w-4 h-4 text-white" />
          )}
        </Button>
      </form>
    </div>
  );
}

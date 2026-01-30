'use client';

import React from 'react';
import DOMPurify from 'dompurify';
import { ChatMessage as ChatMessageType } from '@/types';
import { cn } from '@/lib/utils/cn';
import { Bot, User, Loader2 } from 'lucide-react';
import PhoneCard from '@/components/phone/PhoneCard';

interface ChatMessageProps {
  message: ChatMessageType;
  onCompare?: (phoneId: number) => void;
  darkMode?: boolean;
}

export default function ChatMessage({ message, onCompare, darkMode = false }: ChatMessageProps) {
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
            <div className="flex items-center gap-3 py-1">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span className="text-sm text-gray-500">{message.content || 'Thinking...'}</span>
            </div>
          ) : (
            <div
              className={cn(
                "prose prose-sm max-w-none",
                darkMode && "prose-invert prose-table:border-gray-600 prose-th:border-gray-600 prose-td:border-gray-600"
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

  // Code blocks (must be processed before other formatting)
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g,
    '<pre class="bg-gray-800 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-sm"><code>$2</code></pre>');

  // Inline code
  result = result.replace(/`([^`]+)`/g,
    '<code class="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

  // Tables (simple markdown table support)
  result = result.replace(/\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g, (match, header, body) => {
    const headerCells = header.split('|').filter((c: string) => c.trim()).map((c: string) =>
      `<th class="border border-gray-300 px-3 py-2 bg-gray-100 font-semibold text-left">${c.trim()}</th>`
    ).join('');
    const bodyRows = body.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) =>
        `<td class="border border-gray-300 px-3 py-2">${c.trim()}</td>`
      ).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table class="w-full border-collapse my-3 text-sm"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-violet-600 hover:underline">$1</a>');

  // Headers (process before line breaks)
  result = result.replace(/^### (.+)$/gm, '<h4 class="font-semibold mt-2 mb-1">$1</h4>');
  result = result.replace(/^## (.+)$/gm, '<h3 class="font-bold mt-3 mb-1 text-lg">$1</h3>');
  result = result.replace(/^# (.+)$/gm, '<h2 class="font-bold mt-4 mb-2 text-xl">$1</h2>');

  // Numbered lists - preserve the original number and display inline
  // This prevents the numbering from resetting when bullet lists appear between items
  result = result.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="numbered-item flex gap-2 my-2 ml-2"><span class="font-bold text-violet-600 min-w-[20px]">$1.</span><strong>$2</strong></div>');

  // Bullet lists - match lines starting with dash or asterisk
  // Also handle dashes that might appear with extra whitespace
  result = result.replace(/^[\s]*[-•*]\s+(.+)$/gm, '<li class="bullet-item ml-8 pl-2">$1</li>');

  // Wrap consecutive bullet list items in <ul>
  result = result.replace(/((?:<li class="bullet-item[^>]*>.*?<\/li>\s*)+)/g, '<ul class="my-1 list-disc space-y-0.5">$1</ul>');

  // Line breaks (but not inside pre/code blocks or tables)
  result = result.replace(/\n(?!<)/g, '<br />');

  // Price formatting - highlight prices in INR
  result = result.replace(/(₹[\d,]+)/g, '<span class="font-semibold text-emerald-600">$1</span>');

  // Sanitize HTML to prevent XSS attacks
  return DOMPurify.sanitize(result, {
    ALLOWED_TAGS: ['strong', 'em', 'a', 'code', 'pre', 'h2', 'h3', 'h4', 'li', 'ul', 'ol', 'br', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
  });
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

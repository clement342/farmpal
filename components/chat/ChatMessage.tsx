'use client';

import type { ChatMessageDisplay } from '@/hooks/useDiagnosisChat';
import { DiagnosisSummary } from './DiagnosisSummary';

interface ChatMessageProps {
  message: ChatMessageDisplay;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-4 sm:px-8 py-2`}>
      <div className={`flex gap-3 max-w-[85%] sm:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-xl bg-accent-subtle border border-accent/20 flex items-center justify-center text-xs font-medium text-accent-text shrink-0 mt-1">
            AI
          </div>
        )}

        <div className="flex flex-col gap-1.5 min-w-0">
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              isUser
                ? 'bg-accent text-black rounded-br-md'
                : isStreaming
                  ? 'bg-surface-elevated border border-border-subtle rounded-bl-md'
                  : 'bg-surface-elevated border border-border-subtle rounded-bl-md'
            }`}
          >
            {message.content || isStreaming ? (
              <p className="whitespace-pre-wrap break-words">
                {message.content}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-accent/70 ml-0.5 animate-pulse align-text-bottom" />
                )}
              </p>
            ) : (
              <span className="text-text-muted italic">Analyzing symptoms...</span>
            )}
          </div>

          {message.createdAt && (
            <span className={`text-[11px] text-text-muted px-1 ${isUser ? 'text-right' : 'text-left'}`}>
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}

          {!isUser && message.diagnosis && !isStreaming && (
            <DiagnosisSummary diagnosis={message.diagnosis} />
          )}
        </div>
      </div>
    </div>
  );
}

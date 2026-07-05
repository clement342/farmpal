'use client';

import { useRef, useEffect } from 'react';
import type { ChatMessageDisplay } from '@/hooks/useDiagnosisChat';
import { ChatMessage } from './ChatMessage';
import { EmptyState } from './EmptyState';

interface ChatMessagesProps {
  messages: ChatMessageDisplay[];
  hasCrop: boolean;
}

export function ChatMessages({ messages, hasCrop }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return <EmptyState hasCrop={hasCrop} />;
  }

  return (
    <div className="flex-1 overflow-y-auto py-4 space-y-1">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

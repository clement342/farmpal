'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchHistory } from '@/lib/api/history';
import type { HistoryRecord } from '@/types';

interface ChatSidebarProps {
  activeConversationId: string | null;
  onNewChat: () => void;
  open: boolean;
  onClose: () => void;
  refreshKey?: number;
}

export function ChatSidebar({ activeConversationId, onNewChat, open, onClose, refreshKey }: ChatSidebarProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory({ limit: 20 })
      .then((data) => setConversations(data.records))
      .catch(() => {
        // Silently handle — sidebar shows empty state
      })
      .finally(() => setLoading(false));
  }, [activeConversationId, refreshKey]);

  const content = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border-subtle">
        <Link
          href="/"
          className="flex items-center gap-2.5 mb-4"
        >
          <span className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center text-black text-[10px] font-bold">
            F
          </span>
          <span className="text-sm font-medium tracking-tight">FarmPal</span>
        </Link>

        <button
          onClick={() => {
            router.push('/diagnose');
            onNewChat();
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:border-accent/50 hover:text-accent-text transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Diagnosis
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-surface animate-pulse" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center">
            <div className="w-10 h-10 mx-auto mb-4 rounded-xl bg-surface border border-border-subtle flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p className="text-sm text-text-primary font-medium mb-1">Sync your history</p>
            <p className="text-xs text-text-muted leading-relaxed">
              Sign in to save and access your diagnosis history across devices.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((record) => {
              const isActive = record.conversation.id === activeConversationId;
              const lastMsg = record.conversation.messages?.[record.conversation.messages.length - 1];
              return (
                <Link
                  key={record.id}
                  href={`/conversation/${record.conversation.id}`}
                  onClick={onClose}
                  className={`block p-3 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-accent-subtle border border-accent/20'
                      : 'hover:bg-surface border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-accent-text">{record.cropName || 'Unidentified crop'}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      record.diagnosis ? 'bg-accent' : 'bg-yellow-500'
                    }`} />
                    <span className="text-[10px] text-text-muted">
                      {record.diagnosis ? 'Completed' : 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted truncate">
                    {lastMsg?.content || record.initialSymptoms || 'No messages'}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-72 lg:w-80 border-r border-border-subtle bg-surface/50 flex-col shrink-0">
        {content}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={onClose} />
          <aside className="md:hidden fixed inset-y-0 left-0 w-72 bg-background border-r border-border-subtle z-50 animate-fade-in">
            {content}
          </aside>
        </>
      )}
    </>
  );
}

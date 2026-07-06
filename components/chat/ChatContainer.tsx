'use client';

import { useState } from 'react';
import type { Crop } from '@/types/crop';
import { useDiagnosisChat } from '@/hooks/useDiagnosisChat';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatComposer } from './ChatComposer';
import { ChatSidebar } from './ChatSidebar';
import { CropSelector } from './CropSelector';
import { DetectedCropBadge } from './DetectedCropBadge';

interface ChatContainerProps {
  conversationId?: string;
  crop?: Crop;
}

export function ChatContainer({ conversationId, crop }: ChatContainerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    messages,
    status,
    error,
    selectedCrop,
    detectedCrop,
    conversationId: activeConversationId,
    setCrop,
    sendMessage,
    reset,
  } = useDiagnosisChat({ conversationId: conversationId ?? null, crop });

  const isStreaming = status === 'streaming';
  const isDisabled = isStreaming;

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar
        activeConversationId={activeConversationId}
        onNewChat={reset}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Open sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex-1 flex items-center justify-between min-w-0">
            <CropSelector selected={selectedCrop} onSelect={setCrop} />
            {conversationId && (
              <button
                onClick={reset}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                New chat
              </button>
            )}
          </div>
        </div>

        {/* Chat header (desktop) */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <CropSelector selected={selectedCrop} onSelect={setCrop} />
            </div>
            {conversationId && (
              <button
                onClick={reset}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                New chat
              </button>
            )}
          </div>
        </div>

        {/* Detected crop badge — only show when auto-detected, not manually selected */}
        {detectedCrop && !selectedCrop && (
          <div className="px-4 sm:px-8 pt-3 pb-1">
            <DetectedCropBadge
              cropName={detectedCrop.cropName}
              confidence={detectedCrop.confidence}
            />
          </div>
        )}

        <ChatHeader
          crop={selectedCrop}
          isStreaming={isStreaming}
          messageCount={messages.length}
        />

        <ChatMessages
          messages={messages}
          hasCrop={!!selectedCrop || !!detectedCrop}
        />

        {/* Error banner */}
        {error && (
          <div className="mx-4 sm:mx-8 mb-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        <ChatComposer
          onSend={sendMessage}
          disabled={isDisabled}
          loading={isStreaming}
          placeholder="Describe what you're seeing. Example: &quot;My maize leaves have yellow streaks and brown spots.&quot;"
        />
      </div>
    </div>
  );
}

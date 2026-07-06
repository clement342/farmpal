'use client';

import type { Crop } from '@/types/crop';

interface ChatHeaderProps {
  crop: Crop | null;
  isStreaming: boolean;
  messageCount: number;
}

export function ChatHeader({ crop, isStreaming, messageCount }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-border-subtle bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 min-w-0">
        {crop && (
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-accent-subtle border border-accent/20 flex items-center justify-center text-[11px] font-medium text-accent-text shrink-0">
              {crop.name[0]}
            </span>
            <span className="text-sm font-medium text-text-primary truncate">{crop.name}</span>
          </div>
        )}

        {messageCount > 0 && (
          <>
            <span className="w-1 h-1 rounded-full bg-border-hover" />
            <span className="text-xs text-text-muted">
              {messageCount} {messageCount === 1 ? 'message' : 'messages'}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-accent animate-pulse-dot' : 'bg-accent'}`} />
        <span className="text-xs text-text-muted">
          {isStreaming ? 'AI is analyzing...' : 'Local AI Ready'}
        </span>
      </div>
    </div>
  );
}

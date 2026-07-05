'use client';

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 sm:px-8 py-2">
      <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-surface-elevated border border-border-subtle">
        <span className="w-2 h-2 rounded-full bg-text-muted animate-pulse-dot" style={{ animationDelay: '0s' }} />
        <span className="w-2 h-2 rounded-full bg-text-muted animate-pulse-dot" style={{ animationDelay: '0.15s' }} />
        <span className="w-2 h-2 rounded-full bg-text-muted animate-pulse-dot" style={{ animationDelay: '0.3s' }} />
      </div>
    </div>
  );
}

/**
 * Chat interface loading skeleton.
 *
 * Mirrors ChatContainer's real layout:
 *   - Left sidebar (hidden on mobile)
 *   - Top header strip (crop selector + new chat button)
 *   - Messages area with a few placeholder bubbles
 *   - Bottom composer bar
 *
 * Uses the `.skeleton` shimmer utility from globals.css.
 */
export function ChatLoadingSkeleton() {
  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">

      {/* ── Sidebar (desktop only) ──────────────────────────────────── */}
      <aside className="hidden md:flex w-64 flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="skeleton h-5 w-20 rounded" />
          <div className="skeleton h-7 w-7 rounded-lg" />
        </div>
        {/* Conversation list items */}
        <div className="flex-1 p-3 space-y-1">
          {[90, 75, 85, 60, 80].map((pct, i) => (
            <div key={i} className="px-3 py-2.5 rounded-lg space-y-1">
              <div className="skeleton h-3.5 rounded" style={{ width: `${pct}%` }} />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top header strip */}
        <div className="flex items-center gap-3 px-4 sm:px-8 py-3 border-b border-[var(--border)]">
          {/* Mobile menu button */}
          <div className="skeleton h-8 w-8 rounded-lg md:hidden" />
          {/* Crop selector */}
          <div className="skeleton h-8 w-40 rounded-lg" />
          <div className="flex-1" />
          {/* New chat */}
          <div className="skeleton h-5 w-16 rounded" />
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-hidden px-4 sm:px-8 py-6 space-y-4">
          {/* Outgoing message (right-aligned) */}
          <div className="flex justify-end">
            <div className="skeleton h-10 w-56 rounded-2xl rounded-tr-sm" />
          </div>
          {/* Incoming message (left-aligned, wider) */}
          <div className="flex flex-col gap-2 max-w-lg">
            <div className="skeleton h-4 w-64 rounded" />
            <div className="skeleton h-4 w-48 rounded" />
            <div className="skeleton h-4 w-56 rounded" />
          </div>
          {/* Another outgoing */}
          <div className="flex justify-end">
            <div className="skeleton h-10 w-72 rounded-2xl rounded-tr-sm" />
          </div>
          {/* Typing indicator */}
          <div className="flex items-center gap-1.5 px-4 py-3 w-20">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-2 h-2 rounded-full bg-[var(--text-muted)]"
                style={{ animation: `pulse-dot 1.4s ease-in-out ${delay}ms infinite` }}
              />
            ))}
          </div>
        </div>

        {/* Composer bar */}
        <div className="px-4 sm:px-8 py-4 border-t border-[var(--border)]">
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>

      </div>
    </div>
  );
}

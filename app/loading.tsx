/**
 * Root loading skeleton.
 *
 * Shown by Next.js App Router while the landing page suspends.
 * Mirrors the real page structure: fixed nav bar + hero section.
 * Uses the `.skeleton` shimmer utility from globals.css.
 */
export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)]">
      {/* ── Nav bar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo placeholder */}
          <div className="skeleton h-6 w-24 rounded-md" />
          {/* Nav links */}
          <div className="hidden md:flex items-center gap-6">
            {[72, 80, 64, 56].map((w, i) => (
              <div key={i} className="skeleton h-4 rounded" style={{ width: w }} />
            ))}
          </div>
          {/* CTA button */}
          <div className="skeleton h-9 w-28 rounded-lg" />
        </div>
      </header>

      {/* ── Hero section ─────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="w-full max-w-3xl text-center space-y-6">
          {/* Badge */}
          <div className="flex justify-center">
            <div className="skeleton h-6 w-48 rounded-full" />
          </div>
          {/* Heading — two lines */}
          <div className="space-y-3">
            <div className="skeleton h-12 w-full max-w-xl mx-auto rounded-xl" />
            <div className="skeleton h-12 w-3/4 mx-auto rounded-xl" />
          </div>
          {/* Sub-text */}
          <div className="space-y-2 max-w-lg mx-auto">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-5/6 mx-auto rounded" />
          </div>
          {/* Buttons */}
          <div className="flex justify-center gap-3 pt-2">
            <div className="skeleton h-11 w-36 rounded-xl" />
            <div className="skeleton h-11 w-28 rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}

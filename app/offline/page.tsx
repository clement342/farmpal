/**
 * Offline fallback page.
 *
 * Served by the service worker when a navigation request fails because
 * the device has no network connection. This page itself is precached
 * during the service worker install step so it is always available.
 *
 * Note: the offline knowledge base and diagnosis engine still work
 * fully — this page only appears for navigations, not API calls.
 */
export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-[#0f1a0f]">
      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">You're offline</h1>
      <p className="text-gray-400 max-w-sm mb-8">
        No internet connection detected. FarmPal's offline diagnosis still
        works — open the app and describe your crop symptoms.
      </p>

      {/* Offline capabilities reminder */}
      <ul className="text-left space-y-2 mb-8">
        {[
          'Crop disease diagnosis via offline AI',
          'Full knowledge base for 16 crops',
          'Disease identification & treatment guides',
        ].map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
            <svg
              className="w-4 h-4 text-green-500 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            {item}
          </li>
        ))}
      </ul>

      <a
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
      >
        Go to FarmPal
      </a>
    </main>
  );
}

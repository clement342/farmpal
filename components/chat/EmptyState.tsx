'use client';

interface EmptyStateProps {
  hasCrop: boolean;
}

export function EmptyState({ hasCrop }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-accent-subtle border border-accent/20 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-text">
            <path d="M12 2a4 4 0 0 0-4 4v4h-2a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4v-2a4 4 0 0 0-4-4h-2V6a4 4 0 0 0-4-4z" />
            <path d="M12 14v4" />
            <path d="M10 16h4" />
          </svg>
        </div>

        <h2 className="text-lg font-medium text-text-primary mb-2">
          {hasCrop ? 'Describe the symptoms' : 'Select a crop to start'}
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          {hasCrop
            ? 'Tell FarmPal what you see — yellowing leaves, spots, stunted growth. The AI will ask follow-up questions to narrow it down.'
            : 'Choose a crop from the dropdown above to begin your diagnosis session.'}
        </p>
      </div>
    </div>
  );
}

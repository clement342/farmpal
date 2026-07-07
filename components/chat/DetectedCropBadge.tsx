'use client';

interface DetectedCropBadgeProps {
  cropName: string;
  confidence: string;
}

const confidenceColors: Record<string, string> = {
  high: 'bg-accent-subtle text-accent-text border-accent/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const confidenceLabels: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function DetectedCropBadge({ cropName, confidence }: DetectedCropBadgeProps) {
  const color = confidenceColors[confidence] || confidenceColors.high;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${color}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M12 2a4 4 0 0 0-4 4v4h-2a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4v-2a4 4 0 0 0-4-4h-2V6a4 4 0 0 0-4-4z" />
      </svg>
      <span>
        Detected: <strong>{cropName}</strong>
      </span>
      <span className="opacity-60">·</span>
      <span className="opacity-80">{confidenceLabels[confidence] || confidence} confidence</span>
    </div>
  );
}

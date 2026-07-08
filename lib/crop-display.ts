const UNRESOLVED_CROP_VALUES = new Set(['unknown', 'unspecified', 'not specified', '']);

/**
 * Returns true when a crop name is a meaningful, display-ready label.
 */
export function isResolvedCropName(name?: string | null): boolean {
  if (!name) return false;
  return !UNRESOLVED_CROP_VALUES.has(name.trim().toLowerCase());
}

/**
 * Returns true when a crop ID is usable for lookups (not a placeholder).
 */
export function isResolvedCropId(id?: string | null): boolean {
  if (!id) return false;
  return !UNRESOLVED_CROP_VALUES.has(id.trim().toLowerCase());
}

export function truncateText(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}

export interface HistoryDisplayInput {
  cropName?: string;
  diseaseName?: string;
  initialSymptoms?: string;
}

/**
 * Primary label for a history sidebar item.
 * Prefers crop name, then disease name, then a snippet of the initial symptoms.
 */
export function getHistoryTitle(input: HistoryDisplayInput): string {
  if (isResolvedCropName(input.cropName)) return input.cropName!;
  if (input.diseaseName) return input.diseaseName;
  if (input.initialSymptoms) return truncateText(input.initialSymptoms, 52);
  return 'Diagnosis session';
}

/**
 * Secondary label shown beneath the history item title.
 */
export function getHistorySubtitle(input: HistoryDisplayInput): string | null {
  if (isResolvedCropName(input.cropName) && input.diseaseName) {
    return input.diseaseName;
  }
  if (isResolvedCropName(input.cropName)) {
    return 'Crop diagnosis';
  }
  if (input.diseaseName) {
    return 'Condition identified';
  }
  return null;
}

/**
 * Formats a date as a compact relative time string for sidebar use.
 */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

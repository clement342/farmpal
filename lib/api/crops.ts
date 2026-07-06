import type { Crop } from '@/types/crop';

/**
 * Fetches the list of all supported crops from the backend.
 */
export async function fetchCrops(): Promise<Crop[]> {
  const response = await fetch('/api/crops');

  if (!response.ok) {
    throw new Error(`Failed to fetch crops (${response.status})`);
  }

  const json = await response.json();
  return json.data as Crop[];
}

import { describe, expect, it } from 'vitest';
import {
  formatRelativeTime,
  getHistorySubtitle,
  getHistoryTitle,
  isResolvedCropName,
} from '@/lib/crop-display';

describe('crop-display', () => {
  describe('isResolvedCropName', () => {
    it('treats Unknown and Not specified as unresolved', () => {
      expect(isResolvedCropName('Unknown')).toBe(false);
      expect(isResolvedCropName('Not specified')).toBe(false);
      expect(isResolvedCropName('')).toBe(false);
    });

    it('accepts real crop names', () => {
      expect(isResolvedCropName('Maize')).toBe(true);
      expect(isResolvedCropName('Cassava')).toBe(true);
    });
  });

  describe('getHistoryTitle', () => {
    it('prefers crop name when available', () => {
      expect(getHistoryTitle({
        cropName: 'Maize',
        diseaseName: 'Leaf Blight',
        initialSymptoms: 'yellow leaves',
      })).toBe('Maize');
    });

    it('falls back to disease name when crop is unknown', () => {
      expect(getHistoryTitle({
        cropName: 'Unknown',
        diseaseName: 'Cassava Mosaic Disease',
        initialSymptoms: 'yellow leaves on my plant',
      })).toBe('Cassava Mosaic Disease');
    });

    it('falls back to symptom snippet when crop and disease are missing', () => {
      const title = getHistoryTitle({
        cropName: 'Unknown',
        initialSymptoms: 'My plant has yellow leaves and brown spots spreading quickly',
      });
      expect(title).toContain('yellow leaves');
      expect(title.endsWith('…')).toBe(true);
    });
  });

  describe('getHistorySubtitle', () => {
    it('shows disease under crop name', () => {
      expect(getHistorySubtitle({
        cropName: 'Maize',
        diseaseName: 'Leaf Blight',
      })).toBe('Leaf Blight');
    });

    it('returns null when only symptoms are available', () => {
      expect(getHistorySubtitle({
        cropName: 'Unknown',
        initialSymptoms: 'wilting leaves',
      })).toBeNull();
    });
  });

  describe('formatRelativeTime', () => {
    it('formats recent timestamps', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
    });
  });
});

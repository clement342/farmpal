import { knowledgeService } from '@/services/knowledge.service';
import { isResolvedCropId, isResolvedCropName } from '@/lib/crop-display';

export interface CropContext {
  cropId?: string;
  cropName?: string;
}

/**
 * Resolves a human-readable crop name from a crop ID, optionally
 * falling back to a MongoDB crop document name.
 */
export function resolveCropName(cropId?: string, mongoCrop?: { name?: string }): string {
  if (mongoCrop?.name) return mongoCrop.name;
  if (!isResolvedCropId(cropId)) return '';
  const kbCrop = knowledgeService.getCrop(cropId!);
  return kbCrop?.name ?? '';
}

/**
 * Resolves the best available crop context for persisting a diagnosis,
 * checking the request, conversation record, and knowledge base.
 */
export function resolveDiagnosisCropContext(
  requestCropId?: string,
  conversation?: CropContext | null,
  mongoCrop?: { name?: string } | null,
): { cropId: string; cropName: string } {
  const cropId = isResolvedCropId(requestCropId)
    ? requestCropId!
    : isResolvedCropId(conversation?.cropId)
      ? conversation!.cropId!
      : '';

  const fromLookup = resolveCropName(cropId || undefined, mongoCrop ?? undefined);
  const fromConversation = isResolvedCropName(conversation?.cropName)
    ? conversation!.cropName!
    : '';

  const cropName = fromLookup || fromConversation;

  return {
    cropId: cropId || 'unspecified',
    cropName: cropName || '',
  };
}

/**
 * Enriches a stored crop name for display, resolving from cropId when
 * the persisted name is missing or a placeholder like "Unknown".
 */
export function enrichCropName(
  cropId?: string,
  cropName?: string,
  conversationCrop?: CropContext,
): string {
  if (isResolvedCropName(cropName)) return cropName!;

  const effectiveCropId = isResolvedCropId(cropId)
    ? cropId
    : isResolvedCropId(conversationCrop?.cropId)
      ? conversationCrop!.cropId
      : undefined;

  if (effectiveCropId) {
    const resolved = resolveCropName(effectiveCropId);
    if (resolved) return resolved;
  }

  if (isResolvedCropName(conversationCrop?.cropName)) {
    return conversationCrop!.cropName!;
  }

  return '';
}

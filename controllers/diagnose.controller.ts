import type { ConversationDiagnosisResponse, DiagnosisRequest } from '@/types';
import { conversationOrchestrator } from '@/services/conversation/ConversationOrchestrator';
import { createDiagnosis, processFollowUp, streamDiagnosis } from '@/services/diagnose.service';
import { validateDiagnosisRequest, validateCropExists } from '@/lib/validation';
import { knowledgeService } from '@/services/knowledge.service';

export async function handleDiagnosisRequest(
  body: unknown,
): Promise<ConversationDiagnosisResponse> {
  const request: DiagnosisRequest = validateDiagnosisRequest(body);

  if (!request.cropId) {
    const inference = knowledgeService.inferCrop(request.symptoms);
    if (inference.detected && inference.crop) {
      request.cropId = inference.crop.id;
    }
  }

  if (request.cropId) {
    await validateCropExists(request.cropId);
  }

  const { decision } = await conversationOrchestrator.execute(request);

  switch (decision.nextAction) {
    case 'ANSWER_FOLLOWUP':
      return processFollowUp(request);

    default:
      return createDiagnosis(request);
  }
}

export async function handleStreamDiagnosis(
  body: unknown,
): Promise<ReadableStream<Uint8Array>> {
  const request: DiagnosisRequest = validateDiagnosisRequest(body);

  let detectedCropInfo: { cropId: string; cropName: string; confidence: string } | undefined;

  if (!request.cropId) {
    const inference = knowledgeService.inferCrop(request.symptoms);
    if (inference.detected && inference.crop) {
      request.cropId = inference.crop.id;
      detectedCropInfo = {
        cropId: inference.crop.id,
        cropName: inference.crop.name,
        confidence: inference.confidence,
      };
    }
  }

  if (request.cropId) {
    await validateCropExists(request.cropId);
  }

  const { decision } = await conversationOrchestrator.execute(request);

  let stream: ReadableStream<Uint8Array>;

  switch (decision.nextAction) {
    case 'ANSWER_FOLLOWUP': {
      const result = await processFollowUp(request);
      stream = createSimpleStream(result);
      break;
    }

    default:
      stream = await streamDiagnosis(request);
  }

  if (detectedCropInfo) {
    return prependCropDetectedEvent(stream, detectedCropInfo);
  }

  return stream;
}

function prependCropDetectedEvent(
  original: ReadableStream<Uint8Array>,
  info: { cropId: string; cropName: string; confidence: string },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = original.getReader();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const event = `data: ${JSON.stringify({ type: 'crop_detected', ...info })}\n\n`;
      controller.enqueue(encoder.encode(event));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }
      controller.close();
    },
  });
}

function createSimpleStream(
  response: ConversationDiagnosisResponse,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const text =
    response.response.status === 'follow_up'
      ? response.response.question
      : response.response.diagnosis.reasoning;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'result', ...response })}\n\n`));
      controller.close();
    },
  });
}

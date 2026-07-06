import { useCallback, useRef, useState } from 'react';
import { streamDiagnosis, type StreamEvent } from '@/lib/api/diagnose';
import type { DiagnosisRequest } from '@/types';

interface UseStreamingOptions {
  onChunk?: (text: string) => void;
  onResult?: (event: StreamEvent & { type: 'result' }) => void;
  onError?: (message: string) => void;
  onCropDetected?: (info: { cropId: string; cropName: string; confidence: string }) => void;
}

interface UseStreamingReturn {
  /** Whether a stream is currently active */
  isStreaming: boolean;
  /** The error message if the last stream failed */
  error: string | null;
  /** Start a new streaming diagnosis request */
  start: (body: DiagnosisRequest) => Promise<void>;
  /** Cancel the active stream */
  cancel: () => void;
}

/**
 * Manages a single SSE streaming connection to the diagnosis endpoint.
 *
 * Yields raw text chunks via `onChunk` and the final result via `onResult`.
 * Supports cancellation via AbortController.
 */
export function useStreaming(options: UseStreamingOptions): UseStreamingReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (body: DiagnosisRequest) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setError(null);

      try {
        for await (const event of streamDiagnosis(body, controller.signal)) {
          if (controller.signal.aborted) break;

          switch (event.type) {
            case 'chunk':
              options.onChunk?.(event.text);
              break;
            case 'crop_detected':
              options.onCropDetected?.({
                cropId: event.cropId,
                cropName: event.cropName,
                confidence: event.confidence,
              });
              break;
            case 'result':
              options.onResult?.(event);
              break;
            case 'error':
              setError(event.message);
              options.onError?.(event.message);
              break;
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Failed to connect to diagnosis service';
        setError(message);
        options.onError?.(message);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [options],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { isStreaming, error, start, cancel };
}

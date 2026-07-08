import { useCallback, useEffect, useRef, useState } from 'react';
import type { Crop } from '@/types/crop';
import type { ChatMessage, ConversationDiagnosisResponse } from '@/types';
import type { DiagnosisResult } from '@/types/diagnosis';
import { useStreaming } from './useStreaming';
import { fetchHistory } from '@/lib/api/history';
import { isResolvedCropId, isResolvedCropName } from '@/lib/crop-display';

export interface ChatMessageDisplay {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isStreaming?: boolean;
  diagnosis?: DiagnosisResult;
}

export type ChatStatus = 'idle' | 'loading' | 'streaming' | 'completed' | 'error';

interface UseDiagnosisChatOptions {
  conversationId?: string | null;
  crop?: Crop;
}

interface UseDiagnosisChatReturn {
  messages: ChatMessageDisplay[];
  status: ChatStatus;
  error: string | null;
  selectedCrop: Crop | null;
  detectedCrop: { cropId: string; cropName: string; confidence: string } | null;
  conversationId: string | null;
  setCrop: (crop: Crop | null) => void;
  sendMessage: (symptoms: string) => Promise<void>;
  reset: () => void;
  cancelStream: () => void;
}

let messageCounter = 0;

function generateId(): string {
  messageCounter += 1;
  return `msg_${Date.now()}_${messageCounter}`;
}

/**
 * Core chat hook for the FarmPal diagnosis interface.
 *
 * Manages conversation state, messages, streaming, and error handling.
 * Supports both streaming and fallback non-streaming diagnosis.
 *
 * @param options - Optional initial conversation context for resuming chats.
 */
export function useDiagnosisChat(options?: UseDiagnosisChatOptions): UseDiagnosisChatReturn {
  const [messages, setMessages] = useState<ChatMessageDisplay[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(options?.crop ?? null);
  const [detectedCrop, setDetectedCrop] = useState<{
    cropId: string;
    cropName: string;
    confidence: string;
  } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(options?.conversationId ?? null);
  const streamContentRef = useRef('');
  const loadingConversationRef = useRef<string | null>(null);

  // Load conversation history when conversationId prop changes
  useEffect(() => {
    const targetId = options?.conversationId;
    if (!targetId) return;
    if (loadingConversationRef.current === targetId) return;
    loadingConversationRef.current = targetId;

    setConversationId(targetId);
    setStatus('loading');
    setMessages([]);
    setSelectedCrop(options?.crop ?? null);

    fetchHistory({ limit: 100 })
      .then((data) => {
        const match = data.records.find(
          (r) => r.conversation.id === targetId,
        );
        if (match) {
          const mappedMessages: ChatMessageDisplay[] =
            match.conversation.messages.map((m: ChatMessage) => ({
              id: m.id || generateId(),
              role: m.role as 'user' | 'assistant',
              content: m.content,
              createdAt: m.createdAt || new Date().toISOString(),
            }));
          setMessages(mappedMessages);

          if (match.diagnosis) {
            setMessages((prev) => {
              const copy = [...prev];
              const lastAssistant = copy
                .slice()
                .reverse()
                .find((m) => m.role === 'assistant');
              if (lastAssistant && !lastAssistant.diagnosis) {
                lastAssistant.diagnosis = {
                  possibleCauses: [
                    {
                      name: match.diagnosis!.diseaseName,
                      confidence: match.diagnosis!.confidence,
                      reasoning: match.diagnosis!.reasoning,
                    },
                  ],
                  reasoning: match.diagnosis!.reasoning,
                  recommendations: [
                    ...match.diagnosis!.immediateActions.map((a: string) => ({
                      text: a,
                      category: 'immediate_action' as const,
                    })),
                    ...match.diagnosis!.preventiveMeasures.map((a: string) => ({
                      text: a,
                      category: 'preventive' as const,
                    })),
                  ],
                  urgency: match.diagnosis!.severity as 'low' | 'moderate' | 'high' | 'critical',
                  extensionOfficerAdvice: match.diagnosis!.extensionOfficerAdvice,
                };
              }
              return copy;
            });
          }

          if (!options?.crop) {
            const cropId = match.cropId && isResolvedCropId(match.cropId)
              ? match.cropId
              : isResolvedCropName(match.cropName)
                ? match.cropName.toLowerCase().replace(/\s+/g, '-')
                : null;
            const cropName = isResolvedCropName(match.cropName) ? match.cropName : null;

            if (cropId && cropName) {
              setSelectedCrop({
                id: cropId,
                name: cropName,
                regions: [],
                growthStages: [],
                commonDiseaseIds: [],
              });
            }
          }

          setStatus('completed');
        } else {
          setStatus('idle');
        }
      })
      .catch(() => {
        setStatus('idle');
      });
  }, [options?.conversationId, options?.crop]);

  // Reset loading guard when conversation is explicitly reset
  useEffect(() => {
    if (!conversationId && loadingConversationRef.current) {
      loadingConversationRef.current = null;
    }
  }, [conversationId]);

  const handleChunk = useCallback((text: string) => {
    streamContentRef.current += text;
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant' && last.isStreaming) {
        copy[copy.length - 1] = { ...last, content: streamContentRef.current };
      }
      return copy;
    });
  }, []);

  const handleResult = useCallback(
    (event: { conversationId: string; status: 'ACTIVE' | 'COMPLETED'; response: ConversationDiagnosisResponse['response'] }) => {
      setConversationId(event.conversationId);
      setStatus('completed');

      const finalContent = streamContentRef.current;
      streamContentRef.current = '';

      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant' && last.isStreaming) {
          const displayContent =
            event.response.status === 'follow_up'
              ? event.response.question
              : event.response.status === 'diagnosis'
                ? event.response.diagnosis.reasoning
                : finalContent;
          copy[copy.length - 1] = {
            ...last,
            content: displayContent,
            isStreaming: false,
            diagnosis:
              event.response.status === 'diagnosis'
                ? event.response.diagnosis
                : undefined,
          };
        }
        return copy;
      });
    },
    [],
  );

  const handleError = useCallback((message: string) => {
    setError(message);
    setStatus('error');
    streamContentRef.current = '';

    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant' && last.isStreaming) {
        copy[copy.length - 1] = { ...last, isStreaming: false };
      }
      return copy;
    });
  }, []);

  const { isStreaming, start: startStream, cancel } = useStreaming({
    onChunk: handleChunk,
    onResult: handleResult,
    onError: handleError,
    onCropDetected: (info) => setDetectedCrop(info),
  });

  const sendMessage = useCallback(
    async (symptoms: string) => {
      const userMsg: ChatMessageDisplay = {
        id: generateId(),
        role: 'user',
        content: symptoms,
        createdAt: new Date().toISOString(),
      };

      const assistantMsg: ChatMessageDisplay = {
        id: generateId(),
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStatus('streaming');
      setError(null);

      try {
        await startStream({
          symptoms,
          cropId: selectedCrop?.id ?? detectedCrop?.cropId ?? undefined,
          conversationId: conversationId ?? undefined,
        });
      } catch {
        // Error is handled in useStreaming's onError
      }
    },
    [selectedCrop, detectedCrop, conversationId, startStream],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setStatus('idle');
    setError(null);
    setConversationId(null);
    streamContentRef.current = '';
  }, []);

  return {
    messages,
    status: isStreaming ? 'streaming' : status,
    error,
    selectedCrop,
    detectedCrop,
    conversationId,
    setCrop: setSelectedCrop,
    sendMessage,
    reset,
    cancelStream: cancel,
  };
}

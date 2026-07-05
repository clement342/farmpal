import { useCallback, useEffect, useRef, useState } from 'react';
import type { Crop } from '@/types/crop';
import type { ChatMessage, ConversationDiagnosisResponse } from '@/types';
import type { DiagnosisResult } from '@/types/diagnosis';
import { useStreaming } from './useStreaming';
import { fetchHistory } from '@/lib/api/history';

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
  const [conversationId, setConversationId] = useState<string | null>(options?.conversationId ?? null);
  const streamContentRef = useRef('');
  const hasInitialized = useRef(false);

  // Load existing conversation history on mount
  useEffect(() => {
    if (hasInitialized.current || !options?.conversationId) return;
    hasInitialized.current = true;

    setStatus('loading');
    fetchHistory({ limit: 100 })
      .then((data) => {
        const match = data.records.find(
          (r) => r.conversation.id === options.conversationId,
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

          if (!options.crop) {
            setSelectedCrop({
              id: match.cropName.toLowerCase(),
              name: match.cropName,
              regions: [],
              growthStages: [],
              commonDiseaseIds: [],
            });
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
          copy[copy.length - 1] = {
            ...last,
            content: finalContent,
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
  });

  const sendMessage = useCallback(
    async (symptoms: string) => {
      if (!selectedCrop) return;

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
          cropId: selectedCrop.id,
          conversationId: conversationId ?? undefined,
        });
      } catch {
        // Error is handled in useStreaming's onError
      }
    },
    [selectedCrop, conversationId, startStream],
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
    conversationId,
    setCrop: setSelectedCrop,
    sendMessage,
    reset,
    cancelStream: cancel,
  };
}

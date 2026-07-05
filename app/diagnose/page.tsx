import type { Metadata } from 'next';
import { ChatContainer } from '@/components/chat/ChatContainer';

export const metadata: Metadata = {
  title: 'Diagnose — FarmPal',
  description: 'Start a new crop disease diagnosis conversation with FarmPal AI.',
};

/**
 * Diagnosis chat page.
 *
 * Entry point for starting a new diagnosis conversation.
 * Users select a crop and describe symptoms to begin.
 */
export default function DiagnosePage() {
  return <ChatContainer />;
}

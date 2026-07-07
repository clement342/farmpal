import type { Metadata } from 'next';
import { ChatContainer } from '@/components/chat/ChatContainer';

export const metadata: Metadata = {
  title: 'Conversation — FarmPal',
  description: 'Continue your crop disease diagnosis conversation.',
};

interface ConversationPageProps {
  params: Promise<{ conversationId: string }>;
}

/**
 * Conversation continuation page.
 *
 * Loads an existing conversation by ID and resumes the diagnosis chat.
 * The ChatContainer fetches the conversation history from the backend.
 *
 * @param params - Route params containing the conversation ID.
 */
export default async function ConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = await params;

  return <ChatContainer conversationId={conversationId} />;
}

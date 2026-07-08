import type { ChatMessage, DiagnosisRequest } from '@/types';
import { ConversationContextLoader } from './ConversationContextLoader';
import { ConversationStateResolver } from './ConversationStateResolver';
import { IntentClassifier } from './IntentClassifier';
import { ConversationDecisionBuilder } from './ConversationDecisionBuilder';
import { KnowledgeContextBuilder } from './KnowledgeContextBuilder';
import { knowledgeService } from '@/services/knowledge.service';
import type { ConversationContext, OrchestratorResult } from './types';

export class ConversationOrchestrator {
  private loader = new ConversationContextLoader();
  private stateResolver = new ConversationStateResolver();
  private classifier = new IntentClassifier();
  private decisionBuilder = new ConversationDecisionBuilder();
  private knowledgeBuilder = new KnowledgeContextBuilder();

  async execute(request: DiagnosisRequest): Promise<OrchestratorResult> {
    const startTime = Date.now();

    // 1. Load conversation context
    const loaded = await this.loader.load(request);

    // 2. Resolve state
    const state = this.stateResolver.resolve({
      conversation: loaded.conversation,
      conversationId: loaded.conversationId,
    });

    // 3. Build conversation context
    const cropId = request.cropId ?? loaded.conversation?.cropId;
    const context: ConversationContext = {
      conversationId: loaded.conversationId,
      conversation: loaded.conversation,
      status: state.status,
      stage: state.stage,
      latestUserMessage: request.symptoms,
      recentMessages: (loaded.conversation?.messages ?? []).map(mapMessageSubDoc),
      previousRecommendations: [],
      requiresClarification: state.requiresClarification,
      currentCrop: cropId ? knowledgeService.getCrop(cropId) ?? undefined : undefined,
    };

    // 4. Classify intent (no knowledge needed yet)
    const classification = this.classifier.classify(context);

    // 5. Build decision
    const decision = this.decisionBuilder.build(context, state, classification);

    // 6. Lazy knowledge loading: only for intents that can benefit
    if (classification.intent === 'NEW_DIAGNOSIS' || classification.intent === 'GENERAL_AGRICULTURE_QUESTION') {
      context.knowledgeContext = await this.knowledgeBuilder.build(context);
    }

    // 7. Log decision
    const decisionDuration = Date.now() - startTime;
    console.log('[ConversationOrchestrator]', JSON.stringify({
      conversationId: context.conversationId,
      intent: decision.intent,
      confidence: decision.confidence,
      matchedRules: decision.matchedRules,
      nextAction: decision.nextAction,
      decisionDurationMs: decisionDuration,
    }));

    return { decision, context };
  }
}

export const conversationOrchestrator = new ConversationOrchestrator();

function mapMessageSubDoc(doc: { role: string; content: string; createdAt?: Date }): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: doc.role as ChatMessage['role'],
    content: doc.content,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date().toISOString(),
  };
}

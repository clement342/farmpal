import { knowledgeService } from '@/services/knowledge.service';
import type { ConversationContext, ConversationIntent, IntentClassification, RuleName } from './types';

const SYMPTOM_KEYWORDS = [
  'yellow', 'yellowing', 'spots', 'spotting', 'wilting', 'curling',
  'lesion', 'lesions', 'blight', 'rust', 'mildew', 'rot', 'rotting',
  'brown', 'black', 'white', 'powdery', 'downy', 'streak', 'streaks',
  'stunt', 'stunted', 'mosaic', 'leaf', 'leaves', 'stem', 'root',
  'wilt', 'blotch', 'blotches', 'dieback', 'gummosis', 'canker',
];

const GENERAL_AG_KEYWORDS = [
  'crop rotation', 'fertilizer', 'npk', 'planting season', 'variety',
  'cultivar', 'soil', 'irrigation', 'harvest', 'sowing', 'spacing',
  'compost', 'manure', 'mulch', 'intercrop', 'intercropping',
];

const CORRECTION_MARKERS = [
  'actually', 'i meant', 'correction', 'wrong crop', 'not maize',
  'not cassava', 'not rice', 'not yam', 'not sorghum',
];

const QUESTION_WORDS = ['what', 'why', 'how', 'can', 'which', 'does', 'do', 'is', 'are', 'should'];

export class IntentClassifier {
  classify(context: ConversationContext): IntentClassification {
    const message = context.latestUserMessage.toLowerCase().trim();

    // ── Phase 1: Rules engine ──────────────────────────────────

    // Rule: Short clarification response
    if (context.stage === 'AWAITING_CLARIFICATION' && context.requiresClarification && message.split(/\s+/).length < 5) {
      return {
        intent: 'CLARIFICATION_RESPONSE',
        confidence: 0.95,
        matchedRules: ['SHORT_CLARIFICATION', 'STAGE_AWAITING_CLARIFICATION'],
        reason: 'Short message while AI awaits clarification',
      };
    }

    // Rule: Correction marker
    const hasCorrection = CORRECTION_MARKERS.some((m) => message.includes(m));
    if (hasCorrection) {
      return {
        intent: 'DIAGNOSIS_CORRECTION',
        confidence: 0.88,
        matchedRules: ['CORRECTION_MARKER'],
        reason: 'Message contains correction marker',
      };
    }

    // Rule: Symptom keywords
    const hasSymptomWords = SYMPTOM_KEYWORDS.some((kw) => message.includes(kw));
    if (hasSymptomWords && context.stage === 'NEW') {
      return {
        intent: 'NEW_DIAGNOSIS',
        confidence: 0.85,
        matchedRules: ['SYMPTOM_MATCH'],
        reason: 'Message contains symptom keywords with no active conversation',
      };
    }

    // Rule: Question word starts the message — check before general ag keywords
    // so follow-up questions in an active diagnosis take priority over new topics
    const startsWithQuestionWord = QUESTION_WORDS.some((qw) => message.startsWith(qw));
    const hasExistingDiagnosis = context.recentMessages.length >= 2 && context.stage !== 'NEW';

    if (startsWithQuestionWord && hasExistingDiagnosis) {
      return {
        intent: 'FOLLOW_UP_QUESTION',
        confidence: 0.94,
        matchedRules: ['QUESTION_START', 'HAS_PREVIOUS_DIAGNOSIS'],
        reason: 'Question pattern while an active diagnosis context exists',
      };
    }

    // Rule: General agriculture keywords
    const hasAgKeywords = GENERAL_AG_KEYWORDS.some((kw) => message.includes(kw));
    if (hasAgKeywords) {
      return {
        intent: 'GENERAL_AGRICULTURE_QUESTION',
        confidence: 0.82,
        matchedRules: ['GENERAL_AG_KEYWORD'],
        reason: 'Message contains general agriculture keywords',
      };
    }

    // ── Phase 2: Knowledge lookup ───────────────────────────────
    let knowledgeBoost = 0;
    let matchedKnowledge = false;

    try {
      const searchResults = knowledgeService.search(message);
      if (searchResults.diseases.length > 0 || searchResults.deficiencies.length > 0) {
        knowledgeBoost = 0.15;
        matchedKnowledge = true;
      }
      if (searchResults.crops.length > 0) {
        knowledgeBoost = Math.max(knowledgeBoost, 0.1);
      }
    } catch {
      // Knowledge lookup is best-effort — failure is non-fatal
    }

    if (hasSymptomWords) {
      const confidence = Math.min(0.65 + knowledgeBoost, 1.0);
      const rules: RuleName[] = matchedKnowledge ? ['SYMPTOM_MATCH', 'KNOWLEDGE_LOOKUP'] : ['SYMPTOM_MATCH'];
      return {
        intent: 'NEW_DIAGNOSIS',
        confidence,
        matchedRules: rules,
        reason: matchedKnowledge
          ? 'Symptom keywords matched and knowledge search confirms disease patterns'
          : 'Symptom keywords found but context is uncertain',
      };
    }

    if (startsWithQuestionWord) {
      return {
        intent: 'FOLLOW_UP_QUESTION',
        confidence: 0.55,
        matchedRules: ['QUESTION_START', 'NO_SYMPTOM_KEYWORDS'],
        reason: 'Question pattern but no prior diagnosis context',
      };
    }

    // ── Phase 3: Default ────────────────────────────────────────
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      matchedRules: [],
      reason: 'No rules matched',
    };
  }
}

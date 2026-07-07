import type { Crop } from '@/types/crop';
import type { DiagnosisRequest, DiagnosisResponse, DiagnosisResult, PossibleCause, Recommendation } from '@/types/diagnosis';

/**
 * Mock AI diagnosis adapter.
 *
 * Generates realistic-looking diagnosis responses without calling an actual
 * AI model. This allows the full diagnosis workflow to be developed and
 * tested independently of the AI provider infrastructure.
 *
 * ## Swapping for the real AI provider
 *
 * When the real AI provider is ready, create a new adapter in
 * `adapters/ai/diagnosis.adapter.ts` that implements the same
 * `generateDiagnosis()` signature, then swap the import in the service.
 *
 * The service should never import this adapter directly — it should receive
 * the adapter via dependency injection or import from an adapter factory
 * that can be configured at startup.
 *
 * TODO:
 * - Replace with AIProvider.generateDiagnosis() once the AI layer is ready.
 * - Move mock data to a separate fixtures file if it grows.
 * - Add support for image-based diagnosis.
 */

/**
 * Generates a mock diagnosis response based on the request.
 *
 * returns a `follow_up` response when symptoms are vague,
 * and a `diagnosis` response when the description is detailed.
 *
 * @param request - The diagnosis request
 * @param crop - The affected crop (if found in the database)
 * @returns A diagnosis response
 */
export async function generateDiagnosis(
  request: DiagnosisRequest,
  crop?: Crop,
): Promise<DiagnosisResponse> {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  const symptomLength = request.symptoms.trim().length;

  // Short/vague symptoms trigger a follow-up question
  if (symptomLength < 20) {
    return {
      status: 'follow_up',
      question: buildFollowUpQuestion(request.symptoms, crop),
      options: generateOptions(request.symptoms, crop),
    };
  }

  // Detailed symptoms generate a mock diagnosis
  return {
    status: 'diagnosis',
    diagnosis: buildMockDiagnosis(request, crop),
  };
}

/**
 * Builds a context-aware follow-up question based on the symptoms provided.
 */
function buildFollowUpQuestion(symptoms: string, crop?: Crop): string {
  const lower = symptoms.toLowerCase();

  if (lower.includes('hole') || lower.includes('eaten') || lower.includes('chew')) {
    return 'Which part of the leaf are the holes on — the edges, the centre, or evenly scattered?';
  }
  if (lower.includes('yellow') || lower.includes('wilt') || lower.includes('droop')) {
    return 'Are the lower leaves affected first, or is the yellowing happening on new growth?';
  }
  if (lower.includes('spot') || lower.includes('blight') || lower.includes('lesion')) {
    return 'Do the spots have a defined border, and are they spreading to other plants?';
  }
  if (crop) {
    return `How long ago did you first notice these symptoms on your ${crop.name}?`;
  }

  return 'Could you describe the symptoms in more detail? Which part of the plant is affected?';
}

/**
 * Generates predefined answer options for the follow-up question.
 */
function generateOptions(_symptoms: string, _crop?: Crop): string[] {
  return [
    'Edges of the leaves',
    'Centre of the leaves',
    'Scattered across the leaf surface',
    'The whole plant looks affected',
    'I am not sure',
  ];
}

/**
 * Builds a mock diagnosis result with realistic possible causes and recommendations.
 */
function buildMockDiagnosis(request: DiagnosisRequest, crop?: Crop): DiagnosisResult {
  const possibleCauses = generatePossibleCauses(request.symptoms, crop);
  const topCause = possibleCauses[0];

  return {
    possibleCauses,
    reasoning: `Based on the symptoms described — "${request.symptoms}" — the most likely cause is ${topCause.name.toLowerCase()}. The symptom pattern matches the typical presentation of this condition in ${crop?.name ?? 'the affected crop'}. Secondary possibilities have been listed with lower confidence.`,
    recommendations: generateRecommendations(topCause.name),
    urgency: determineUrgency(request.symptoms),
    extensionOfficerAdvice: 'If symptoms worsen despite applying the recommended actions, consult your local agricultural extension officer within 7 days.',
  };
}

/**
 * Generates ranked possible causes based on symptom keywords.
 */
function generatePossibleCauses(symptoms: string, crop?: Crop): PossibleCause[] {
  const lower = symptoms.toLowerCase();

  const causes: PossibleCause[] = [];

  if (lower.includes('hole') || lower.includes('eaten') || lower.includes('chew')) {
    causes.push(
      { name: 'Fall Armyworm', confidence: 0.82, reasoning: 'Holes in leaves with irregular patterns are characteristic of fall armyworm feeding, especially in maize and cereal crops.' },
      { name: 'Grasshopper Infestation', confidence: 0.45, reasoning: 'Chewed leaf margins can indicate grasshopper activity, though the pattern is less specific.' },
      { name: 'Beetle Feeding Damage', confidence: 0.30, reasoning: 'Certain leaf beetles create shot-hole patterns that resemble the described symptoms.' },
    );
  } else if (lower.includes('yellow') || lower.includes('wilt')) {
    causes.push(
      { name: 'Nutrient Deficiency (Nitrogen)', confidence: 0.70, reasoning: 'General yellowing of older leaves is a classic sign of nitrogen deficiency in most crops.' },
      { name: 'Fusarium Wilt', confidence: 0.55, reasoning: 'Yellowing accompanied by wilting suggests a vascular disease, particularly in warm conditions.' },
      { name: 'Water Stress', confidence: 0.35, reasoning: 'Both overwatering and underwatering can cause yellowing and wilting.' },
    );
  } else if (lower.includes('spot') || lower.includes('blight') || lower.includes('lesion')) {
    causes.push(
      { name: 'Leaf Blight', confidence: 0.75, reasoning: 'Irregular lesions with yellow halos are typical of leaf blight infections, especially in humid conditions.' },
      { name: 'Bacterial Leaf Spot', confidence: 0.60, reasoning: 'Water-soaked spots with angular shapes suggest a bacterial infection.' },
      { name: 'Fungal Leaf Spot', confidence: 0.50, reasoning: 'Circular spots with concentric rings are characteristic of fungal leaf spot diseases.' },
    );
  } else {
    causes.push(
      { name: 'Environmental Stress', confidence: 0.50, reasoning: 'General symptom description could indicate environmental factors such as temperature stress or poor soil conditions.' },
      { name: 'Pest Infestation', confidence: 0.40, reasoning: 'Without specific symptom details, pest damage remains a possibility.' },
      { name: 'Soil Nutrient Imbalance', confidence: 0.35, reasoning: 'Broad symptom descriptions can sometimes point to underlying soil health issues.' },
    );
  }

  if (crop) {
    causes[0].reasoning += ` This is a known issue affecting ${crop.name} in your region.`;
  }

  return causes;
}

/**
 * Generates actionable recommendations based on the top diagnosis.
 */
function generateRecommendations(topCause: string): Recommendation[] {
  const lower = topCause.toLowerCase();

  const recommendations: Recommendation[] = [];

  if (lower.includes('armyworm') || lower.includes('pest') || lower.includes('infestation')) {
    recommendations.push(
      { text: 'Inspect plants early morning or late evening when pests are most active', category: 'immediate_action' },
      { text: 'Apply neem oil or recommended insecticide to affected areas', category: 'immediate_action' },
      { text: 'Remove and destroy severely infested plants to prevent spread', category: 'immediate_action' },
      { text: 'Introduce beneficial insects such as parasitic wasps for long-term control', category: 'preventive' },
      { text: 'Practice crop rotation to break pest life cycles', category: 'preventive' },
      { text: 'Monitor weekly during growing season for early signs of reinfestation', category: 'preventive' },
    );
  } else if (lower.includes('nutrient') || lower.includes('deficiency')) {
    recommendations.push(
      { text: 'Apply a balanced fertiliser with emphasis on the deficient nutrient', category: 'immediate_action' },
      { text: 'Conduct a soil test to confirm nutrient levels', category: 'immediate_action' },
      { text: 'Foliar spray with micronutrients for faster uptake', category: 'immediate_action' },
      { text: 'Incorporate organic matter such as compost to improve soil fertility', category: 'preventive' },
      { text: 'Establish a regular fertilisation schedule based on crop growth stage', category: 'preventive' },
    );
  } else if (lower.includes('blight') || lower.includes('spot') || lower.includes('fungal') || lower.includes('bacterial')) {
    recommendations.push(
      { text: 'Remove and destroy affected plant parts immediately', category: 'immediate_action' },
      { text: 'Apply appropriate fungicide or bactericide following label instructions', category: 'immediate_action' },
      { text: 'Improve air circulation by spacing plants adequately', category: 'immediate_action' },
      { text: 'Avoid overhead watering to reduce leaf wetness', category: 'preventive' },
      { text: 'Use disease-resistant varieties in the next planting season', category: 'preventive' },
      { text: 'Apply mulch to prevent soil-borne pathogens from splashing onto leaves', category: 'preventive' },
    );
  } else {
    recommendations.push(
      { text: 'Monitor the affected plants daily and record any changes', category: 'immediate_action' },
      { text: 'Ensure adequate watering and drainage', category: 'immediate_action' },
      { text: 'Apply a general-purpose organic fertiliser', category: 'immediate_action' },
      { text: 'Maintain good field hygiene by removing weeds and debris', category: 'preventive' },
      { text: 'Plan a soil test during the next dry season', category: 'preventive' },
    );
  }

  recommendations.push({
    text: 'Contact an agricultural extension officer if symptoms persist beyond 7 days',
    category: 'consultation',
  });

  return recommendations;
}

/**
 * Determines urgency level based on symptom keywords.
 */
function determineUrgency(symptoms: string): 'low' | 'moderate' | 'high' | 'critical' {
  const lower = symptoms.toLowerCase();

  if (lower.includes('entire') || lower.includes('all plant') || lower.includes('dead') || lower.includes('dying')) {
    return 'critical';
  }
  if (lower.includes('spread') || lower.includes('rapid') || lower.includes('widespread')) {
    return 'high';
  }
  if (lower.includes('yellow') || lower.includes('wilt') || lower.includes('spot')) {
    return 'moderate';
  }

  return 'low';
}

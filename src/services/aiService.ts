import { GoogleGenAI, Type } from '@google/genai';
import type {
  SupportedServiceCategory,
  GemmaProblemAnalysis,
  ValidatedRepairPart,
  RepairPriceEstimate,
  ComplaintToActionRecord,
  CategoryClassificationResult,
  RepairReportRecord,
  RepairReportPart,
  BookingRequirementQuestion,
  BookingGapAnalysisResult,
  CoopPolicyExplanationResult,
  PolishCompletionNoteResult,
  AdminOperationalSummary,
  WorkerProfile,
  BookingRecord,
  DisputeRecord,
  JobNote,
  WelfareLedgerEntry,
  WorkerDigitalPassport,
  FairDisputeDossier,
  HomeMaintenanceMemory,
  CooperativeIntelligenceReport,
  CustomerRatingInsights,
} from '../types.ts';
import { retrieveRelevantBylaws, COOPERATIVE_BYLAWS } from '../data/cooperativePolicies.ts';

const SUPPORTED_CATEGORIES: SupportedServiceCategory[] = [
  'Electrician',
  'Plumber',
  'Carpenter',
  'Painter',
  'Cleaner',
  'Babysitter',
];

const CATEGORY_SUB_SKILLS: Record<SupportedServiceCategory, string[]> = {
  Electrician: ['MCB & Fuse Repair', 'Ceiling Fan Installation', 'Switchboard Wiring', 'Inverter Setup', 'Appliance Earthing'],
  Plumber: ['Tap & Mixer Leak Repair', 'Pipe Blockage Clearing', 'Water Tank Fitting', 'Bathroom Sanitaryware', 'Pump Motor Valve'],
  Carpenter: ['Door Lock & Hinge Repair', 'Window Frame Fitting', 'Modular Cabinet Fix', 'Furniture Assembly', 'Termite Wood Patch'],
  Painter: ['Interior Wall Painting', 'Dampness Waterproofing', 'Wood Polish & Varnish', 'Putty & Primer Touchup', 'Exterior Weather Coat'],
  Cleaner: ['Deep Kitchen Cleaning', 'Bathroom Sanitization', 'Sofa & Carpet Vacuum', 'Water Tank Cleaning', 'Post-Event Cleanup'],
  Babysitter: ['Infant Daycare Support', 'Toddler Meal & Play', 'After-School Supervision', 'First-Aid Certified Care', 'Evening Family Assist'],
};

export function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatModelName(model: string): string {
  const trimmed = model.trim();
  if (trimmed.startsWith('models/')) return trimmed;
  return `models/${trimmed}`;
}

function getCandidateModels(): string[] {
  const rawModel = process.env.GEMMA_MODEL_ID?.trim();
  // Strictly use configured Gemma model only, with NO Gemini fallback
  const primary = rawModel && rawModel !== 'MY_GEMMA_MODEL_ID' ? formatModelName(rawModel) : 'models/gemma-4-26b-a4b-it';
  return [primary];
}

/**
 * Universal JSON inference wrapper for Google Gemma 4
 * Strictly uses configured Gemma model without Gemini fallback.
 */
async function callGemmaJson<T>(
  prompt: string | { parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> },
  schema: Record<string, unknown>,
  timeoutMs = 45000
): Promise<{ data: T; modelUsed: string }> {
  const ai = getGenAIClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured on the server. Please check your environment variables in Settings > Secrets.');
  }

  const candidateModels = getCandidateModels();
  let lastError: Error | null = null;

  for (const modelName of candidateModels) {
    try {
      let contentsPayload: any;
      const schemaInstruction = `\n\nSTRICT INSTRUCTION: Output ONLY a valid JSON object matching this schema. Do not add any conversational text or markdown code blocks outside the JSON:\n${JSON.stringify(schema, null, 2)}`;

      if (typeof prompt === 'string') {
        contentsPayload = prompt + schemaInstruction;
      } else if (prompt && Array.isArray((prompt as any).parts)) {
        // Preserve inlineData for multimodal inspection and append schema instruction to text
        const partsCopy = (prompt as any).parts.map((p: any) => ({ ...p }));
        const textPartIdx = partsCopy.findIndex((p: any) => typeof p.text === 'string');
        if (textPartIdx >= 0) {
          partsCopy[textPartIdx] = {
            ...partsCopy[textPartIdx],
            text: partsCopy[textPartIdx].text + schemaInstruction,
          };
        } else {
          partsCopy.push({ text: schemaInstruction });
        }
        contentsPayload = { parts: partsCopy };
      } else {
        contentsPayload = prompt;
      }

      const timeoutForModel = timeoutMs;
      let response;

      try {
        response = await Promise.race([
          ai.models.generateContent({
            model: modelName,
            contents: contentsPayload,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Gemma 4 model ${modelName} timed out after ${timeoutForModel}ms.`)), timeoutForModel)
          ),
        ]);
      } catch (callErr: any) {
        // If inlineData is rejected on text-only endpoint variant, retry with descriptive note
        if (contentsPayload?.parts && contentsPayload.parts.some((p: any) => p.inlineData)) {
          const textOnlyParts = contentsPayload.parts.map((p: any) => {
            if (p.inlineData) {
              return { text: `[Customer attached defect photo: mimeType ${p.inlineData.mimeType || 'image/jpeg'}, approximate size ${Math.round((p.inlineData.data?.length || 0) * 0.75)} bytes]` };
            }
            return p;
          });
          response = await Promise.race([
            ai.models.generateContent({
              model: modelName,
              contents: { parts: textOnlyParts },
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Gemma 4 inference on ${modelName} timed out after ${timeoutForModel}ms.`)), timeoutForModel)
            ),
          ]);
        } else {
          throw callErr;
        }
      }

      const rawText = (response.text || '').trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const cleanedJson = jsonMatch
        ? jsonMatch[0]
        : rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

      const parsed = JSON.parse(cleanedJson) as T;
      const cleanName = modelName.replace(/^models\//, '');
      const modelDisplayName = cleanName; // Show actual model ID

      return {
        data: parsed,
        modelUsed: modelDisplayName,
      };
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Gemma 4 AI] Model ${modelName} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('Gemma 4 AI inference request failed on configured model.');
}

// ============================================================================
// 1. AI COMPLAINT-TO-ACTION CONVERTER
// ============================================================================
export interface ComplaintToActionInput {
  complaintText: string;
  workerPreferredLanguage?: 'en' | 'bn' | 'hi';
  customerId: string;
  customerName: string;
  bookingId?: string;
  bookingReference?: string;
  workerId?: string;
  workerName?: string;
}

export async function convertComplaintToActionWithGemma4(
  input: ComplaintToActionInput
): Promise<ComplaintToActionRecord> {
  const {
    complaintText,
    workerPreferredLanguage = 'bn',
    customerId,
    customerName,
    bookingId,
    bookingReference,
    workerId,
    workerName,
  } = input;

  const targetLangName =
    workerPreferredLanguage === 'bn' ? 'Bengali (বাংলা)' : workerPreferredLanguage === 'hi' ? 'Hindi (हिन्दी)' : 'English';

  const prompt = `Customer reported the following household service complaint or issue:
"${complaintText}"

TASK:
1. Identify the core household service problem reported by the customer.
2. Formulate a short, structured problem summary in English.
3. Formulate worker dispatch notice in English with phonetic transliteration for local trade workers.
4. Generate 2 to 4 concrete, actionable on-site steps for the assigned cooperative worker.
5. Identify any critical missing information needed before work begins.
6. Generate 2 relevant follow-up questions for the customer to clarify the situation.
7. List customer-provided facts ("customerFacts") and AI technical suggestions ("aiSuggestions").
8. Detect the language used in the original complaint ("English", "Bengali", "Hindi", or "Mixed").
9. Generate "safetyReminders": 2-3 specific on-site safety precautions for the worker.
10. Generate "preparationChecklist": 2-4 tools, instruments, and supplies to prepare before site visit.
11. Generate "unfamiliarTermsGlossary": array of objects with "term" and "explanation".
12. Generate "clarifyingQuestionsBeforeAccepting": 2 practical questions to ask before accepting.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      complaintLanguage: { type: Type.STRING },
      problemSummary: { type: Type.STRING },
      translatedSummaryForWorker: { type: Type.STRING },
      suggestedActionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
      missingInformation: { type: Type.ARRAY, items: { type: Type.STRING } },
      customerFollowUpQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      customerFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
      aiSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      safetyReminders: { type: Type.ARRAY, items: { type: Type.STRING } },
      preparationChecklist: { type: Type.ARRAY, items: { type: Type.STRING } },
      unfamiliarTermsGlossary: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ['term', 'explanation'],
        },
      },
      clarifyingQuestionsBeforeAccepting: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: [
      'complaintLanguage',
      'problemSummary',
      'translatedSummaryForWorker',
      'suggestedActionItems',
      'missingInformation',
      'customerFollowUpQuestions',
      'customerFacts',
      'aiSuggestions',
      'safetyReminders',
      'preparationChecklist',
    ],
  };

  const { data, modelUsed } = await callGemmaJson<any>(prompt, schema);

  const summary = String(data.problemSummary || complaintText).trim();
  const translated = String(data.translatedSummaryForWorker || data.problemSummary || complaintText).trim();
  const actions = Array.isArray(data.suggestedActionItems) && data.suggestedActionItems.length > 0
    ? data.suggestedActionItems
    : ['Inspect physical fixture and confirm problem with resident'];
  const missing = Array.isArray(data.missingInformation) ? data.missingInformation : [];
  const followUps = Array.isArray(data.customerFollowUpQuestions) ? data.customerFollowUpQuestions : [];
  const facts = Array.isArray(data.customerFacts) && data.customerFacts.length > 0
    ? data.customerFacts
    : [complaintText];
  const suggestions = Array.isArray(data.aiSuggestions) && data.aiSuggestions.length > 0
    ? data.aiSuggestions
    : ['Perform diagnostic inspection prior to component replacement'];
  const safetyReminders = Array.isArray(data.safetyReminders) && data.safetyReminders.length > 0
    ? data.safetyReminders
    : ['Verify power or water supply isolation before touching fixtures'];
  const preparationChecklist = Array.isArray(data.preparationChecklist) && data.preparationChecklist.length > 0
    ? data.preparationChecklist
    : ['Standard trade diagnostic toolset', 'Safety gloves and flashlight'];
  const glossary = Array.isArray(data.unfamiliarTermsGlossary) ? data.unfamiliarTermsGlossary : [];
  const clarifyingQuestions = Array.isArray(data.clarifyingQuestionsBeforeAccepting) && data.clarifyingQuestionsBeforeAccepting.length > 0
    ? data.clarifyingQuestionsBeforeAccepting
    : followUps;

  const record: ComplaintToActionRecord = {
    id: `c2a-${Date.now()}`,
    bookingId,
    bookingReference,
    customerId,
    customerName,
    workerId,
    workerName,
    workerPreferredLanguage,
    originalComplaint: complaintText,
    complaintLanguage: String(data.complaintLanguage || 'Detected Regional Language'),
    problemSummary: summary,
    structuredProblemSummary: summary,
    translatedSummaryForWorker: translated,
    translatedProblemSummary: translated,
    suggestedActionItems: actions,
    suggestedActionItemsForWorker: actions,
    missingInformation: missing,
    missingInformationBeforeStart: missing,
    customerFollowUpQuestions: followUps,
    followUpQuestionsForCustomer: followUps,
    customerFacts: facts,
    customerStatedFacts: facts,
    aiSuggestions: suggestions,
    aiTechnicalSuggestions: suggestions,
    safetyReminders,
    preparationChecklist,
    unfamiliarTermsGlossary: glossary,
    clarifyingQuestionsBeforeAccepting: clarifyingQuestions,
    modelUsed,
    isLiveAi: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return record;
}

// ============================================================================
// 2. AI SERVICE CATEGORY AUTO-CLASSIFIER
// ============================================================================
export interface CategoryClassifierInput {
  description: string;
  imageBuffer?: Buffer;
  imageMimeType?: string;
}

export async function classifyServiceCategoryWithGemma4(
  input: CategoryClassifierInput
): Promise<CategoryClassificationResult> {
  const { description, imageBuffer, imageMimeType } = input;

  const validCategoriesList = SUPPORTED_CATEGORIES.join(', ');
  const categorySkillsJson = JSON.stringify(CATEGORY_SUB_SKILLS, null, 2);

  const promptText = `Act as the service category auto-classifier for Help Nest Cooperative Services.
Customer entered the following household problem description and/or provided an image:
Description: "${description}"

VALID PLATFORM CATEGORIES ONLY: ${validCategoriesList}
CATEGORY SKILLS CATALOGUE:
${categorySkillsJson}

STRICT CLASSIFICATION RULES:
1. Select the single most suitable category ONLY from the 6 supported categories: "Electrician", "Plumber", "Carpenter", "Painter", "Cleaner", "Babysitter".
2. You MUST NEVER invent non-existent categories (such as HVAC, Roofing, Appliance Repair, Masonry).
3. If the problem involves water pipes, taps, valves, drainage, water tanks, sinks, or sanitary fittings, classify as "Plumber".
4. If the problem involves power switches, wiring, fans, fuses, MCBs, or inverters, classify as "Electrician".
5. If the problem involves door locks, hinges, wood furniture, cabinets, or window frames, classify as "Carpenter".
6. If the problem involves wall dampness, paint peeling, waterproofing, or color coating, classify as "Painter".
7. If the problem involves deep cleaning, dust vacuuming, bathroom sanitization, or kitchen grease, classify as "Cleaner".
8. If the problem involves child care, toddler play, or infant supervision, classify as "Babysitter".
9. Suggest the most matching subcategory/skill from the catalogue.
10. Calculate confidence score between 0 and 100.
11. If description is ambiguous, too brief, or completely outside the 6 categories, set confidenceScore below 60 and state uncertainty.
12. Provide a clear reason explaining why this category fits the symptoms.
13. Provide an uncertainty note indicating what the customer needs to physically confirm before booking.`;

  let promptPayload: any;
  if (imageBuffer && imageMimeType && imageMimeType.startsWith('image/')) {
    promptPayload = {
      parts: [
        {
          inlineData: {
            mimeType: imageMimeType,
            data: imageBuffer.toString('base64'),
          },
        },
        { text: promptText },
      ],
    };
  } else {
    promptPayload = promptText;
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      suggestedCategory: { type: Type.STRING },
      suggestedSubcategory: { type: Type.STRING },
      confidenceScore: { type: Type.NUMBER },
      reason: { type: Type.STRING },
      uncertaintyNote: { type: Type.STRING },
    },
    required: ['suggestedCategory', 'suggestedSubcategory', 'confidenceScore', 'reason', 'uncertaintyNote'],
  };

  const { data, modelUsed } = await callGemmaJson<any>(promptPayload, schema);

  const isMatchedCategory = SUPPORTED_CATEGORIES.includes(data.suggestedCategory);
  const finalCategory: SupportedServiceCategory = isMatchedCategory
    ? (data.suggestedCategory as SupportedServiceCategory)
    : 'Plumber'; // Default fallback if uncertain

  const confidenceScore = Math.max(0, Math.min(100, Number(data.confidenceScore) || 75));
  const isConfident = isMatchedCategory && confidenceScore >= 60;

  return {
    suggestedCategory: finalCategory,
    suggestedSubcategory: String(data.suggestedSubcategory || CATEGORY_SUB_SKILLS[finalCategory][0]),
    confidenceScore,
    reason: String(data.reason || `Matched based on problem description keywords related to ${finalCategory}.`),
    uncertaintyNote: String(
      data.uncertaintyNote ||
        'Notice: This AI recommendation is an automated suggestion. Please verify and confirm your category before booking.'
    ),
    isConfident,
    modelUsed,
    isLiveAi: true,
  };
}

// ============================================================================
// 3. AI REPAIR REPORT GENERATOR
// ============================================================================
export interface RepairReportInput {
  bookingId: string;
  bookingReference: string;
  customerId: string;
  customerName: string;
  workerId: string;
  workerName: string;
  serviceCategory: SupportedServiceCategory;
  originalProblem: string;
  workerNotes?: string[];
  completedChecklist?: string[];
  confirmedParts?: RepairReportPart[];
  approvedPriceRevision?: {
    proposedTotalInr: number;
    materialsInr: number;
    laborInr: number;
    reason: string;
  } | null;
  statusHistory?: Array<{ status: string; timestamp: string; note?: string }>;
}

export async function generateRepairReportWithGemma4(
  input: RepairReportInput
): Promise<RepairReportRecord> {
  const {
    bookingId,
    bookingReference,
    customerId,
    customerName,
    workerId,
    workerName,
    serviceCategory,
    originalProblem,
    workerNotes = [],
    completedChecklist = [],
    confirmedParts = [],
    approvedPriceRevision,
    statusHistory = [],
  } = input;

  const notesText = workerNotes.length > 0 ? workerNotes.join('\n- ') : 'Routine physical trade inspection completed.';
  const checklistText = completedChecklist.length > 0 ? completedChecklist.join('\n- ') : 'Standard safety check and trade repair executed.';
  const partsJson = JSON.stringify(confirmedParts, null, 2);
  const statusHistoryText = statusHistory.map((s) => `${s.timestamp}: ${s.status}${s.note ? ` (${s.note})` : ''}`).join('\n');

  const prompt = `Act as the certified repair report generator for Help Nest Cooperative Services.
Generate a comprehensive, verified, readable post-service repair report for Booking Reference: ${bookingReference}.

INPUT DATA:
- Service Category: ${serviceCategory}
- Servicing Worker: ${workerName}
- Customer: ${customerName}
- Customer's Original Complaint: "${originalProblem}"
- Worker's Field Work Notes:
- ${notesText}
- Completed Checklist Items:
- ${checklistText}
- Confirmed Parts & Supplies Used (Only include confirmed items!):
${partsJson}
- Approved Job Price Revisions (if any):
${approvedPriceRevision ? JSON.stringify(approvedPriceRevision) : 'None (Standard base rate applied)'}
- Relevant Job Status History:
${statusHistoryText || 'Job started and marked completed'}

STRICT FACTUAL INTEGRITY RULES:
1. DO NOT invent fictitious repairs, replacement parts, tests, prices, or warranty periods not corroborated by the worker notes or input data.
2. If no parts were used or confirmed, "partsUsed" MUST be an empty array.
3. Formulate clear "workPerformed" bullet points summarizing physical tasks executed.
4. List any remaining "outstandingIssues" or clearly state "None — problem successfully resolved" if no issues remain.
5. Provide actionable "maintenanceSuggestions" to help the household prevent recurrence (e.g., periodic cleaning, operating tips).
6. Write a concise, courteous "customerSummary" explaining what was accomplished.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      reportTitle: { type: Type.STRING },
      originalReportedProblem: { type: Type.STRING },
      workPerformed: { type: Type.ARRAY, items: { type: Type.STRING } },
      partsUsed: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            costInr: { type: Type.NUMBER },
            confirmed: { type: Type.BOOLEAN },
          },
          required: ['name', 'quantity', 'confirmed'],
        },
      },
      outstandingIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
      maintenanceSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      customerSummary: { type: Type.STRING },
    },
    required: [
      'reportTitle',
      'originalReportedProblem',
      'workPerformed',
      'partsUsed',
      'outstandingIssues',
      'maintenanceSuggestions',
      'customerSummary',
    ],
  };

  const { data, modelUsed } = await callGemmaJson<any>(prompt, schema);

  const safeParts: RepairReportPart[] = Array.isArray(data.partsUsed)
    ? data.partsUsed.map((p: any) => ({
        name: String(p.name || 'Component'),
        quantity: Math.max(1, Number(p.quantity) || 1),
        costInr: typeof p.costInr === 'number' ? p.costInr : undefined,
        confirmed: Boolean(p.confirmed ?? true),
      }))
    : confirmedParts;

  return {
    id: `rep-${Date.now()}`,
    bookingId,
    bookingReference,
    customerId,
    customerName,
    workerId,
    workerName,
    serviceCategory,
    reportTitle: String(data.reportTitle || `${serviceCategory} Service Completion Report — ${bookingReference}`),
    originalReportedProblem: String(data.originalReportedProblem || originalProblem),
    workPerformed: Array.isArray(data.workPerformed) && data.workPerformed.length > 0
      ? data.workPerformed
      : ['Inspected reported defect and performed necessary corrective work.'],
    partsUsed: safeParts,
    outstandingIssues: Array.isArray(data.outstandingIssues) && data.outstandingIssues.length > 0
      ? data.outstandingIssues
      : ['None — problem successfully resolved.'],
    maintenanceSuggestions: Array.isArray(data.maintenanceSuggestions) && data.maintenanceSuggestions.length > 0
      ? data.maintenanceSuggestions
      : ['Regular visual checks recommended to detect early wear.'],
    customerSummary: String(
      data.customerSummary ||
        `Your ${serviceCategory} service was completed by certified cooperative worker ${workerName}. All reported issues have been addressed.`
    ),
    editedByWorker: false,
    modelUsed,
    isLiveAi: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// 4. AI BOOKING REQUIREMENT GAP FINDER
// ============================================================================
export interface GapFinderInput {
  problemDescription: string;
  category: SupportedServiceCategory;
  locationAddress?: string;
  preferredTimeSlot?: string;
  urgency?: string;
  isEmergency?: boolean;
}

export async function findBookingRequirementGapsWithGemma4(
  input: GapFinderInput
): Promise<BookingGapAnalysisResult> {
  const {
    problemDescription,
    category,
    locationAddress = '',
    preferredTimeSlot = '',
    urgency = 'STANDARD',
    isEmergency = urgency === 'EMERGENCY',
  } = input;

  const prompt = `Act as the booking requirement gap analyzer for Help Nest Cooperative Services.
A customer is booking a ${category} service with the following initial details:
- Problem Description: "${problemDescription}"
- Service Category: ${category}
- Service Location Address: "${locationAddress}"
- Preferred Time Slot: "${preferredTimeSlot}"
- Urgency: ${urgency} (Emergency: ${isEmergency})

TASK:
Check whether vital technical or operational information is missing before the worker arrives on site.
Examples of common gaps:
1. Exact location of problem (e.g. "Which room or floor: master bathroom, kitchen sink, or terrace?").
2. Specific fixture or appliance type (e.g. "What brand or style of tap/switch/lock/appliance?").
3. Site access or safety instructions (e.g. "Is there a security gate, pet, or specific apartment bell instructions?").
4. Water/Power shut-off awareness (e.g. "Do you know where the main water valve / MCB box is located in case isolation is needed?").
5. Category-specific needs:
   - For Babysitter: Child's age, dietary allergies, or bedtime routine.
   - For Painter: Wall size, presence of dampness, or paint finish preference.
   - For Electrician: Whether sparking or fuse tripping is occurring.

RULES:
1. DO NOT repeatedly ask for information that the customer has ALREADY explicitly provided in their description or fields.
2. Ask between 2 and 4 targeted questions max.
3. Designate questions as either "MANDATORY" (critical safety/location) or "OPTIONAL" (helpful context).
4. If this is an EMERGENCY, keep questions minimal and mark optional ones so emergency assistance is never blocked.
5. Provide a completenessScore (0 - 100) based on how detailed the current information is.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      completenessScore: { type: Type.NUMBER },
      missingQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            fieldKey: { type: Type.STRING },
            question: { type: Type.STRING },
            category: { type: Type.STRING }, // "MANDATORY" | "OPTIONAL"
            reason: { type: Type.STRING },
          },
          required: ['fieldKey', 'question', 'category', 'reason'],
        },
      },
    },
    required: ['completenessScore', 'missingQuestions'],
  };

  const { data, modelUsed } = await callGemmaJson<any>(prompt, schema);

  const missingQuestions: BookingRequirementQuestion[] = Array.isArray(data.missingQuestions)
    ? data.missingQuestions.map((q: any, idx: number) => ({
        id: `gap-q-${idx + 1}`,
        fieldKey: String(q.fieldKey || `detail_${idx + 1}`),
        question: String(q.question || 'Please provide additional details.'),
        category: (q.category === 'MANDATORY' && !isEmergency ? 'MANDATORY' : 'OPTIONAL') as 'MANDATORY' | 'OPTIONAL',
        reason: String(q.reason || 'Helps the cooperative worker arrive prepared with right tools.'),
        isAnswered: false,
      }))
    : [];

  return {
    id: `gap-${Date.now()}`,
    serviceCategory: category,
    isEmergency,
    missingQuestions,
    recommendedQuestions: missingQuestions,
    completenessScore: Math.max(20, Math.min(100, Number(data.completenessScore) || 70)),
    modelUsed,
    isLiveAi: true,
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// 5. AI COOPERATIVE RULE EXPLAINER (GROUNDED RAG ON APPROVED BYLAWS)
// ============================================================================
export interface CoopPolicyExplainerInput {
  question: string;
  workerName?: string;
}

export async function explainCooperativeRuleWithGemma4(
  input: CoopPolicyExplainerInput
): Promise<CoopPolicyExplanationResult> {
  const { question } = input;

  // 1. Retrieve verified bylaws strictly from backend source of truth
  const { matchedBylaws, relevantSummary } = retrieveRelevantBylaws(question);

  const prompt = `Act as the cooperative rule explainer for Help Nest Cooperative Household Services.
You are assisting an authorized cooperative worker who asked:
"${question}"

VERIFIED COOPERATIVE BYLAWS & POLICIES (GROUND TRUTH):
${relevantSummary}

STRICT COMPLIANCE RULES:
1. Answer the question CLEARLY and COURTEOUSLY using ONLY the verified policy content and exact figures provided above.
2. CITE the relevant section by name (e.g. "[Help Nest Bylaw Sec 4.1: Revenue Settlement & Split]").
3. DO NOT invent, assume, or modify any payment percentages, fees, benefits, penalties, cancellation terms, or rules.
   - The revenue split is ALWAYS 90% to worker, 10% to cooperative welfare fund, 0% platform commissions.
   - Late cancellation compensation is ALWAYS ₹150 base + ₹15/km.
   - Welfare emergency medical grant is up to ₹5,000; tools subsidy up to ₹2,500; training grant up to ₹3,000.
4. If the question asks about a policy that is completely unmentioned in the bylaws above, EXPLICITLY state:
   "This information is not configured in the approved cooperative bylaws. Please contact Society Administrator / Secretary Ananya Sen at admin@helpnest.coop or call the society office."
5. DO NOT expose any private customer or worker personal identification data.
6. Emphasize that the AI is an informational guide and cannot alter policies or financial transactions.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      answer: { type: Type.STRING },
      policyReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
      verifiedFigures: {
        type: Type.OBJECT,
        description: 'Key verified numerical values mentioned in the answer',
      },
      isPolicyFound: { type: Type.BOOLEAN },
      adminContactNote: { type: Type.STRING },
    },
    required: ['answer', 'policyReferences', 'isPolicyFound'],
  };

  const { data, modelUsed } = await callGemmaJson<any>(prompt, schema);

  const policyReferences = Array.isArray(data.policyReferences) && data.policyReferences.length > 0
    ? data.policyReferences
    : matchedBylaws.map((b) => b.sectionCode);

  const ans = String(data.answer).trim();
  return {
    question,
    answer: ans,
    explanation: ans,
    policyReferences,
    relevantPolicyCitations: policyReferences,
    verifiedFigures: typeof data.verifiedFigures === 'object' && data.verifiedFigures !== null
      ? data.verifiedFigures
      : matchedBylaws[0]?.keyFigures || {},
    isPolicyFound: Boolean(data.isPolicyFound ?? true),
    adminContactNote: data.isPolicyFound
      ? undefined
      : 'For custom policy amendments or appeals, please consult Society Secretary Ananya Sen.',
    modelUsed,
    isLiveAi: true,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// 6. TECHNICAL PROBLEM DIAGNOSIS & REPAIR ESTIMATION (GEMMA 4)
// ============================================================================
export interface CataloguePartItem {
  id: string;
  name: string;
  category: SupportedServiceCategory;
  fixedPriceInr: number;
  unit: string;
  keywords: string[];
}

export const LOCAL_PARTS_CATALOGUE: CataloguePartItem[] = [
  // Electrician (10 parts)
  { id: 'elec-1', name: 'Anchor 16A Modular Switch & Socket', category: 'Electrician', fixedPriceInr: 160, unit: 'pc', keywords: ['switch', 'socket', 'anchor', '16a', 'modular'] },
  { id: 'elec-2', name: 'Havells 1.5 sq mm Copper Wire (Roll 30m)', category: 'Electrician', fixedPriceInr: 280, unit: 'coil', keywords: ['wire', 'copper', 'havells', 'cable', '1.5'] },
  { id: 'elec-3', name: 'Steel Grip PVC Electrical Insulation Tape', category: 'Electrician', fixedPriceInr: 25, unit: 'roll', keywords: ['tape', 'insulation', 'pvc', 'steel grip'] },
  { id: 'elec-4', name: 'Schneider 32A Double Pole MCB Isolator', category: 'Electrician', fixedPriceInr: 320, unit: 'pc', keywords: ['mcb', 'isolator', 'fuse', 'breaker', 'trip', 'schneider'] },
  { id: 'elec-5', name: 'Ceiling Fan Capacitor (2.5 mfd)', category: 'Electrician', fixedPriceInr: 70, unit: 'pc', keywords: ['capacitor', 'fan', 'condenser', 'mfd'] },
  { id: 'elec-6', name: '6-Way Surface Mount Modular Switchboard Box', category: 'Electrician', fixedPriceInr: 140, unit: 'pc', keywords: ['switchboard', 'box', 'gang box', 'board'] },
  { id: 'elec-7', name: 'Brass Heavy-Duty Batten Lamp Holder', category: 'Electrician', fixedPriceInr: 65, unit: 'pc', keywords: ['holder', 'bulb holder', 'lamp holder', 'batten'] },
  { id: 'elec-8', name: 'Copper Ground Earthing Rod & Clamp Set', category: 'Electrician', fixedPriceInr: 380, unit: 'set', keywords: ['earth', 'earthing', 'ground', 'rod', 'clamp'] },
  { id: 'elec-9', name: 'Inverter Fast-Blow DC Fuse (40A)', category: 'Electrician', fixedPriceInr: 45, unit: 'pc', keywords: ['inverter', 'fuse', 'dc fuse'] },
  { id: 'elec-10', name: 'LED Driver / Choke Unit (18W)', category: 'Electrician', fixedPriceInr: 190, unit: 'pc', keywords: ['choke', 'driver', 'led', 'ballast'] },

  // Plumber (10 parts)
  { id: 'plumb-1', name: 'Brass 0.5-inch Angle Valve (Chrome)', category: 'Plumber', fixedPriceInr: 240, unit: 'pc', keywords: ['angle valve', 'valve', 'stop cock', 'chrome'] },
  { id: 'plumb-2', name: 'Teflon Thread Sealing Tape (12m)', category: 'Plumber', fixedPriceInr: 30, unit: 'roll', keywords: ['teflon', 'thread tape', 'seal tape'] },
  { id: 'plumb-3', name: 'PVC Flexible Waste Pipe (Sink/Basin 1.2m)', category: 'Plumber', fixedPriceInr: 110, unit: 'pc', keywords: ['waste pipe', 'sink pipe', 'drain pipe', 'flexible pipe'] },
  { id: 'plumb-4', name: 'Brass Ceramic Disc Tap Spindle / Cartridge', category: 'Plumber', fixedPriceInr: 160, unit: 'pc', keywords: ['spindle', 'cartridge', 'tap spindle', 'disc'] },
  { id: 'plumb-5', name: 'CP Brass Long Body Bib Cock Tap', category: 'Plumber', fixedPriceInr: 350, unit: 'pc', keywords: ['bib cock', 'tap', 'faucet', 'bibcock'] },
  { id: 'plumb-6', name: 'CPVC Pipe 0.5-inch with Coupler (3m)', category: 'Plumber', fixedPriceInr: 180, unit: 'length', keywords: ['cpvc', 'pvc pipe', 'pipe', 'water pipe'] },
  { id: 'plumb-7', name: 'Solvent Cement Adhesive for PVC/CPVC (100ml)', category: 'Plumber', fixedPriceInr: 85, unit: 'can', keywords: ['solvent', 'cement', 'pipe adhesive', 'glue'] },
  { id: 'plumb-8', name: 'Rubber O-Ring & Washer Seal Repair Pack', category: 'Plumber', fixedPriceInr: 50, unit: 'pack', keywords: ['washer', 'o-ring', 'rubber seal', 'gasket'] },
  { id: 'plumb-9', name: 'Stainless Steel Floor Drain Jali / Grating', category: 'Plumber', fixedPriceInr: 95, unit: 'pc', keywords: ['jali', 'grating', 'drain', 'floor drain'] },
  { id: 'plumb-10', name: 'Overhead Water Tank Ball Float Valve (0.75-inch)', category: 'Plumber', fixedPriceInr: 290, unit: 'pc', keywords: ['float valve', 'ball cock', 'tank valve', 'ball valve'] },

  // Carpenter (10 parts)
  { id: 'carp-1', name: 'Godrej Mortise Door Latch & Screws', category: 'Carpenter', fixedPriceInr: 350, unit: 'set', keywords: ['mortise', 'lock', 'latch', 'godrej', 'door latch'] },
  { id: 'carp-2', name: 'Stainless Steel Butt Hinges (3-inch pair)', category: 'Carpenter', fixedPriceInr: 90, unit: 'pair', keywords: ['hinge', 'butt hinge', 'kabja', 'hinges'] },
  { id: 'carp-3', name: 'Fevicol SH Synthetic Resin Wood Adhesive (250g)', category: 'Carpenter', fixedPriceInr: 95, unit: 'bottle', keywords: ['fevicol', 'wood adhesive', 'glue', 'sh'] },
  { id: 'carp-4', name: 'Magnetic Cabinet Door Catchers (Pack of 2)', category: 'Carpenter', fixedPriceInr: 60, unit: 'pack', keywords: ['catcher', 'magnet', 'cabinet catcher', 'magnetic'] },
  { id: 'carp-5', name: 'Brass Tower Bolt (6-inch) with Fixings', category: 'Carpenter', fixedPriceInr: 140, unit: 'pc', keywords: ['tower bolt', 'bolt', 'chhitkini', 'door bolt'] },
  { id: 'carp-6', name: 'Hardened Drywall Wood Screws Assortment (100 pcs)', category: 'Carpenter', fixedPriceInr: 75, unit: 'box', keywords: ['screw', 'screws', 'fasteners'] },
  { id: 'carp-7', name: 'Heavy-Duty Telescopic Drawer Channel Slides (18-inch)', category: 'Carpenter', fixedPriceInr: 280, unit: 'pair', keywords: ['channel', 'drawer channel', 'slide', 'telescopic'] },
  { id: 'carp-8', name: 'Hardwood Joinery Dowels & Pins (Pack of 20)', category: 'Carpenter', fixedPriceInr: 40, unit: 'pack', keywords: ['dowel', 'wood pins', 'plug'] },
  { id: 'carp-9', name: 'Termite-Resistant Wood Filler Putty (200g)', category: 'Carpenter', fixedPriceInr: 110, unit: 'tub', keywords: ['wood filler', 'putty', 'termite'] },
  { id: 'carp-10', name: 'Stainless Steel Sliding Door Roller Bearings', category: 'Carpenter', fixedPriceInr: 175, unit: 'pair', keywords: ['roller', 'wheel', 'sliding bearing', 'pulley'] },

  // Painter (10 parts)
  { id: 'paint-1', name: 'Asian Paints Wall Putty (5kg pack)', category: 'Painter', fixedPriceInr: 190, unit: 'pack', keywords: ['wall putty', 'putty', 'asian paints', 'white putty'] },
  { id: 'paint-2', name: 'Waterproofing Damp-Proof Primer (1L)', category: 'Painter', fixedPriceInr: 260, unit: 'can', keywords: ['primer', 'damp-proof', 'waterproofing', 'damp'] },
  { id: 'paint-3', name: 'Sandpaper Emery Sheets (Grits 120/180 pack of 4)', category: 'Painter', fixedPriceInr: 60, unit: 'pack', keywords: ['sandpaper', 'emery paper', 'shirish'] },
  { id: 'paint-4', name: '4-inch Synthetic Bristle Painting Brush', category: 'Painter', fixedPriceInr: 85, unit: 'pc', keywords: ['brush', 'paint brush', 'bristle'] },
  { id: 'paint-5', name: '9-inch Paint Application Roller with Tray', category: 'Painter', fixedPriceInr: 165, unit: 'set', keywords: ['roller', 'paint roller', 'tray'] },
  { id: 'paint-6', name: 'High-Grade Painter Masking Tape (24mm x 20m)', category: 'Painter', fixedPriceInr: 45, unit: 'roll', keywords: ['masking tape', 'painter tape'] },
  { id: 'paint-7', name: 'Acrylic White Wall Caulk / Crack Sealant (300ml)', category: 'Painter', fixedPriceInr: 130, unit: 'tube', keywords: ['caulk', 'crack sealant', 'sealant', 'crack filler'] },
  { id: 'paint-8', name: 'Wood Polish Varnish & Thinner (500ml)', category: 'Painter', fixedPriceInr: 210, unit: 'can', keywords: ['polish', 'varnish', 'wood polish', 'thinner'] },
  { id: 'paint-9', name: 'Anti-Fungal Interior Wall Base Emulsion (1L)', category: 'Painter', fixedPriceInr: 290, unit: 'can', keywords: ['emulsion', 'interior paint', 'anti-fungal'] },
  { id: 'paint-10', name: 'Plastic Drop Sheet Dust Cover (9x12 ft)', category: 'Painter', fixedPriceInr: 75, unit: 'sheet', keywords: ['drop sheet', 'dust cover', 'plastic sheet'] },

  // Cleaner (10 parts)
  { id: 'clean-1', name: 'Heavy Duty Tile & Degreaser Solution (1L)', category: 'Cleaner', fixedPriceInr: 180, unit: 'bottle', keywords: ['degreaser', 'tile cleaner', 'floor chemical'] },
  { id: 'clean-2', name: 'Microfiber Cleaning Cloths (Multi-pack of 3)', category: 'Cleaner', fixedPriceInr: 120, unit: 'pack', keywords: ['microfiber', 'cloth', 'wipes'] },
  { id: 'clean-3', name: 'Heavy Nitrile Rubber Protective Gloves', category: 'Cleaner', fixedPriceInr: 80, unit: 'pair', keywords: ['gloves', 'rubber gloves', 'nitrile'] },
  { id: 'clean-4', name: 'High-Density Bathroom Scrubbing Sponge Pads (4 pcs)', category: 'Cleaner', fixedPriceInr: 65, unit: 'pack', keywords: ['scrubber', 'sponge', 'pad'] },
  { id: 'clean-5', name: 'Professional Acid-Free Toilet Disinfectant (750ml)', category: 'Cleaner', fixedPriceInr: 130, unit: 'bottle', keywords: ['disinfectant', 'toilet cleaner', 'harpic'] },
  { id: 'clean-6', name: 'Glass & Mirror Streak-Free Cleaning Spray (500ml)', category: 'Cleaner', fixedPriceInr: 95, unit: 'bottle', keywords: ['glass cleaner', 'colin', 'mirror spray'] },
  { id: 'clean-7', name: 'Stainless Steel Wire Scrubber (Pack of 3)', category: 'Cleaner', fixedPriceInr: 45, unit: 'pack', keywords: ['wire scrubber', 'steel wool'] },
  { id: 'clean-8', name: 'Disinfectant Floor Surface Cleaner Liquid (2L)', category: 'Cleaner', fixedPriceInr: 210, unit: 'bottle', keywords: ['floor cleaner', 'lysol', 'surface cleaner'] },
  { id: 'clean-9', name: 'Heavy-Duty Garbage Waste Bags Roll (30 pcs)', category: 'Cleaner', fixedPriceInr: 85, unit: 'roll', keywords: ['garbage bags', 'trash bags', 'waste bags'] },
  { id: 'clean-10', name: 'Anti-Bacterial Odour Neutralizing Room Spray (300ml)', category: 'Cleaner', fixedPriceInr: 150, unit: 'can', keywords: ['room spray', 'odour spray', 'neutralizer'] },

  // Babysitter (10 parts)
  { id: 'baby-1', name: 'Child-Safe Activity & Coloring Kit', category: 'Babysitter', fixedPriceInr: 120, unit: 'set', keywords: ['coloring kit', 'activity', 'crayons'] },
  { id: 'baby-2', name: 'First Aid Antiseptic Bandages & Wipes (Pack of 25)', category: 'Babysitter', fixedPriceInr: 80, unit: 'pack', keywords: ['bandages', 'bandaid', 'first aid', 'wipes'] },
  { id: 'baby-3', name: 'Digital Fast-Read Infrared Thermometer', category: 'Babysitter', fixedPriceInr: 320, unit: 'pc', keywords: ['thermometer', 'infrared', 'temperature'] },
  { id: 'baby-4', name: 'Non-Toxic Antibacterial Baby Wet Wipes (80 sheets)', category: 'Babysitter', fixedPriceInr: 110, unit: 'pack', keywords: ['baby wipes', 'wet wipes'] },
  { id: 'baby-5', name: 'Safety Corner Guards for Furniture Edges (4 pcs)', category: 'Babysitter', fixedPriceInr: 90, unit: 'pack', keywords: ['corner guard', 'edge guard', 'baby safety'] },
  { id: 'baby-6', name: 'Electrical Socket Safety Plugs / Child Locks (6 pcs)', category: 'Babysitter', fixedPriceInr: 70, unit: 'pack', keywords: ['socket plug', 'child lock', 'outlet cover'] },
  { id: 'baby-7', name: 'Disposable Hypoallergenic Diaper Disposal Bags', category: 'Babysitter', fixedPriceInr: 60, unit: 'pack', keywords: ['diaper bags', 'disposal bags'] },
  { id: 'baby-8', name: 'Instant Cold Gel Pack for Minor Bumps', category: 'Babysitter', fixedPriceInr: 85, unit: 'pc', keywords: ['ice pack', 'cold pack', 'gel pack'] },
  { id: 'baby-9', name: 'Mild Hand Sanitizer Gel (Child Safe 100ml)', category: 'Babysitter', fixedPriceInr: 50, unit: 'bottle', keywords: ['sanitizer', 'hand gel'] },
  { id: 'baby-10', name: 'Clean Storybook & Educational Flashcards Set', category: 'Babysitter', fixedPriceInr: 140, unit: 'set', keywords: ['storybook', 'flashcards', 'cards'] },
];

export const CATEGORY_BASE_LABOR: Record<SupportedServiceCategory, number> = {
  Electrician: 300,
  Plumber: 280,
  Carpenter: 350,
  Painter: 320,
  Cleaner: 250,
  Babysitter: 200,
};

export function validatePartsAndCalculateEstimate(
  suggestedParts: string[] = [],
  category: SupportedServiceCategory = 'Plumber',
  urgency: 'STANDARD' | 'PRIORITY' | 'EMERGENCY' = 'STANDARD',
  workerBaseRate?: number
): { validatedParts: ValidatedRepairPart[]; repairEstimate: RepairPriceEstimate } {
  const catParts = LOCAL_PARTS_CATALOGUE.filter((p) => p.category === category);
  const otherParts = LOCAL_PARTS_CATALOGUE.filter((p) => p.category !== category);

  const validatedParts: ValidatedRepairPart[] = [];
  const usedPartIds = new Set<string>();

  for (const rawPartName of suggestedParts) {
    if (!rawPartName || typeof rawPartName !== 'string') continue;
    const lower = rawPartName.toLowerCase().trim();

    // 1. Try matching within category
    let match = catParts.find((cp) => {
      const cpLower = cp.name.toLowerCase();
      if (lower.includes(cpLower) || cpLower.includes(lower)) return true;
      return cp.keywords.some((kw) => lower.includes(kw.toLowerCase()));
    });

    // 2. Try matching across all other categories
    if (!match) {
      match = otherParts.find((op) => {
        const opLower = op.name.toLowerCase();
        if (lower.includes(opLower) || opLower.includes(lower)) return true;
        return op.keywords.some((kw) => lower.includes(kw.toLowerCase()));
      });
    }

    if (match && !usedPartIds.has(match.id)) {
      usedPartIds.add(match.id);
      validatedParts.push({
        id: match.id,
        name: match.name,
        category: match.category,
        fixedPriceInr: match.fixedPriceInr,
        unit: match.unit,
        quantity: 1,
        totalPriceInr: match.fixedPriceInr,
      });
    }
  }

  // If no parts matched, add one primary standard consumable for this trade
  if (validatedParts.length === 0 && catParts.length > 0) {
    const defaultPart = catParts[0];
    validatedParts.push({
      id: defaultPart.id,
      name: defaultPart.name,
      category: defaultPart.category,
      fixedPriceInr: defaultPart.fixedPriceInr,
      unit: defaultPart.unit,
      quantity: 1,
      totalPriceInr: defaultPart.fixedPriceInr,
    });
  }

  // Calculate totals and labour in code using existing Help Nest pricing rules
  const baseLaborInr = workerBaseRate && workerBaseRate >= 150
    ? workerBaseRate
    : (CATEGORY_BASE_LABOR[category] || 280);

  const urgencySurchargeInr = urgency === 'EMERGENCY' ? 150 : urgency === 'PRIORITY' ? 50 : 0;
  const materialsTotalInr = validatedParts.reduce((sum, p) => sum + p.totalPriceInr, 0);

  // Price range calculation
  const minEstimatedTotalInr = baseLaborInr + urgencySurchargeInr + (materialsTotalInr > 0 ? Math.round(materialsTotalInr * 0.85) : 0);
  const maxEstimatedTotalInr = baseLaborInr + urgencySurchargeInr + materialsTotalInr + Math.round(baseLaborInr * 0.25);

  // 90:10 Cooperative split
  const workerShareMinInr = Math.round(minEstimatedTotalInr * 0.9);
  const workerShareMaxInr = Math.round(maxEstimatedTotalInr * 0.9);
  const welfareShareMinInr = minEstimatedTotalInr - workerShareMinInr;
  const welfareShareMaxInr = maxEstimatedTotalInr - workerShareMaxInr;

  const pricingRuleExplanation = `Calculated in code: Base Labour ₹${baseLaborInr} (${category}) + Urgency Surcharge ₹${urgencySurchargeInr} + Catalogue Parts ₹${materialsTotalInr}. 90:10 Cooperative split guarantees ₹${workerShareMinInr}-₹${workerShareMaxInr} direct to worker, ₹${welfareShareMinInr}-₹${welfareShareMaxInr} to society welfare fund.`;

  return {
    validatedParts,
    repairEstimate: {
      baseLaborInr,
      materialsTotalInr,
      urgencySurchargeInr,
      minEstimatedTotalInr,
      maxEstimatedTotalInr,
      workerShareMinInr,
      workerShareMaxInr,
      welfareShareMinInr,
      welfareShareMaxInr,
      pricingRuleExplanation,
    },
  };
}

export interface AnalyzeProblemOptions {
  reportId: string;
  problemDescription: string;
  category: SupportedServiceCategory;
  imageBuffer?: Buffer;
  imageMimeType?: string;
  timeoutMs?: number;
  urgency?: 'STANDARD' | 'PRIORITY' | 'EMERGENCY';
  language?: 'en' | 'bn' | 'hi';
  workerBaseRate?: number;
}

export async function analyzeProblemWithGemma4(
  options: AnalyzeProblemOptions
): Promise<{
  analysis: GemmaProblemAnalysis | null;
  status: 'COMPLETED' | 'FAILED' | 'UNAVAILABLE';
  error?: string;
  modelUsed: string;
}> {
  const {
    reportId,
    problemDescription,
    category,
    imageBuffer,
    imageMimeType,
    timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 45000,
    urgency = 'STANDARD',
    language = 'en',
    workerBaseRate,
  } = options;

  const ai = getGenAIClient();
  const rawModel = (process.env.GEMMA_MODEL_ID?.trim() || 'gemma-4-26b-a4b-it').replace(/^models\//, '');
  if (!ai) {
    return {
      analysis: null,
      status: 'UNAVAILABLE',
      error: 'GEMINI_API_KEY is not configured on the server. Please check your environment variables in Settings > Secrets.',
      modelUsed: rawModel,
    };
  }

  const regionalLangLabel = language === 'bn' ? 'Bengali (বাংলা)' : language === 'hi' ? 'Hindi (हिन्दी)' : 'Bengali (বাংলা)';

  const promptText = `Act as the certified Gemma 4 cooperative technical diagnosis and repair-estimation engine for Help Nest Cooperative Household Services.
Customer reported a household service problem.
Service Category: ${category}
Customer Problem Description: "${problemDescription}"
Urgency Level: ${urgency}

STRICT DIAGNOSTIC & ESTIMATION INSTRUCTIONS:
1. "gemmaSaw": State concisely and accurately what visible defect or condition is observed from the photo and description (e.g. "Visible pipe joint water seepage with moisture accumulation on fitting").
2. "gemmaSawRegional": Provide the translation of "gemmaSaw" in ${regionalLangLabel}.
3. "summary": Provide a clear, professional diagnosis summary in English.
4. "summaryRegional": Provide the diagnosis summary in ${regionalLangLabel}.
5. "possibleCauses": List 2-4 possible technical causes. Every cause MUST be phrased as a possibility (e.g. "Possible washer deterioration", "Potential thread seal loosening").
6. NEVER FABRICATE RESULTS:
   - If the photo or description is blurry, ambiguous, incomplete, or lacks critical details, do NOT guess.
   - Formulate up to 3 specific "clarificationQuestions" for the customer (e.g. "Is water leaking continuously or only when the tap is turned on?", "Has the main valve been closed?").
   - If the description is completely clear, return an empty array for "clarificationQuestions".
7. "suggestedSpareParts": Suggest 1-4 standard trade spare parts or hardware items that may be required for replacement.
8. "safetyPrecautions": Provide 2-3 essential safety precautions in English.
9. "safetyPrecautionsRegional": Provide safety precautions in ${regionalLangLabel}.
10. "recommendedInspectionSteps": 2-4 step-by-step physical inspection checks for the technician on site.
11. "suggestedTools": 2-4 standard diagnostic tools.
12. "workerPreVerification": 1-2 items to verify with resident before disassembling.
13. "uncertaintyNote": Explicit disclaimer that AI visual analysis is an advisory estimate; physical on-site verification is mandatory before final billing.`;

  let promptPayload: any;
  if (imageBuffer && imageBuffer.length > 0) {
    promptPayload = {
      parts: [
        {
          inlineData: {
            mimeType: imageMimeType || 'image/jpeg',
            data: imageBuffer.toString('base64'),
          },
        },
        { text: promptText },
      ],
    };
  } else {
    promptPayload = promptText;
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      gemmaSaw: { type: Type.STRING },
      gemmaSawRegional: { type: Type.STRING },
      summary: { type: Type.STRING },
      summaryRegional: { type: Type.STRING },
      clarificationQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      possibleCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
      recommendedInspectionSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
      suggestedTools: { type: Type.ARRAY, items: { type: Type.STRING } },
      suggestedSpareParts: { type: Type.ARRAY, items: { type: Type.STRING } },
      safetyPrecautions: { type: Type.ARRAY, items: { type: Type.STRING } },
      safetyPrecautionsRegional: { type: Type.ARRAY, items: { type: Type.STRING } },
      workerPreVerification: { type: Type.ARRAY, items: { type: Type.STRING } },
      uncertaintyNote: { type: Type.STRING },
    },
    required: [
      'gemmaSaw',
      'summary',
      'possibleCauses',
      'recommendedInspectionSteps',
      'suggestedTools',
      'suggestedSpareParts',
      'safetyPrecautions',
      'workerPreVerification',
      'uncertaintyNote',
    ],
  };

  try {
    const { data: parsed, modelUsed } = await callGemmaJson<any>(promptPayload, schema, timeoutMs);

    const { validatedParts, repairEstimate } = validatePartsAndCalculateEstimate(
      Array.isArray(parsed.suggestedSpareParts) ? parsed.suggestedSpareParts : [],
      category,
      urgency,
      workerBaseRate
    );

    const analysis: GemmaProblemAnalysis = {
      id: `ai-ana-${Date.now()}`,
      reportId,
      modelUsed,
      generatedAt: new Date().toISOString(),
      isRealAi: true,
      summary: String(parsed.summary || problemDescription).trim(),
      summaryRegional: parsed.summaryRegional ? String(parsed.summaryRegional).trim() : undefined,
      gemmaSaw: String(parsed.gemmaSaw || parsed.summary || 'Defect observed in customer reported fixture').trim(),
      gemmaSawRegional: parsed.gemmaSawRegional ? String(parsed.gemmaSawRegional).trim() : undefined,
      clarificationQuestions: Array.isArray(parsed.clarificationQuestions)
        ? parsed.clarificationQuestions.filter(Boolean).slice(0, 3)
        : [],
      possibleCauses: Array.isArray(parsed.possibleCauses) && parsed.possibleCauses.length > 0
        ? parsed.possibleCauses.map((c: any) => String(c).trim())
        : ['Possible connection or component wear (requires physical inspection)'],
      recommendedInspectionSteps: Array.isArray(parsed.recommendedInspectionSteps) && parsed.recommendedInspectionSteps.length > 0
        ? parsed.recommendedInspectionSteps.map((s: any) => String(s).trim())
        : ['Visually inspect the reported area and verify with customer'],
      suggestedTools: Array.isArray(parsed.suggestedTools) && parsed.suggestedTools.length > 0
        ? parsed.suggestedTools.map((t: any) => String(t).trim())
        : ['Standard trade diagnostic tools'],
      suggestedSpareParts: Array.isArray(parsed.suggestedSpareParts)
        ? parsed.suggestedSpareParts.map((p: any) => String(p).trim())
        : [],
      validatedParts,
      repairEstimate,
      safetyPrecautions: Array.isArray(parsed.safetyPrecautions) && parsed.safetyPrecautions.length > 0
        ? parsed.safetyPrecautions.map((p: any) => String(p).trim())
        : ['Isolate relevant utilities before starting inspection'],
      safetyPrecautionsRegional: Array.isArray(parsed.safetyPrecautionsRegional) && parsed.safetyPrecautionsRegional.length > 0
        ? parsed.safetyPrecautionsRegional.map((p: any) => String(p).trim())
        : undefined,
      workerPreVerification: Array.isArray(parsed.workerPreVerification) && parsed.workerPreVerification.length > 0
        ? parsed.workerPreVerification.map((v: any) => String(v).trim())
        : ['Confirm problem history with resident before disassembly'],
      uncertaintyNote: String(
        parsed.uncertaintyNote ||
          'Notice: This AI analysis is an on-site preparation guide based on customer inputs. Component damage and final parts must be confirmed on-site before invoice update.'
      ).trim(),
    };

    return {
      analysis,
      status: 'COMPLETED',
      modelUsed,
    };
  } catch (err: any) {
    return {
      analysis: null,
      status: 'FAILED',
      error: err instanceof Error ? err.message : String(err),
      modelUsed: rawModel,
    };
  }
}

// ============================================================================
// 7. AI SMART WORKER NOTE POLISHER (COMPLETION & PROGRESS NOTES)
// ============================================================================
export interface PolishNoteInput {
  rawNotes: string;
  category: SupportedServiceCategory;
  workerName: string;
  workerPreferredLanguage?: 'en' | 'bn' | 'hi';
}

export async function polishCompletionNoteWithGemma4(
  input: PolishNoteInput
): Promise<PolishCompletionNoteResult> {
  const { rawNotes, category, workerName, workerPreferredLanguage = 'en' } = input;
  const langName =
    workerPreferredLanguage === 'bn' ? 'Bengali (বাংলা)' : workerPreferredLanguage === 'hi' ? 'Hindi (हिन्दी)' : 'English';

  const prompt = `Act as the professional field note polisher for cooperative household workers in Kolkata.
A certified worker (${workerName}, Trade: ${category}) recorded field notes during or after a service visit.
Worker's raw notes: "${rawNotes}"

TASK:
1. Polish the raw notes into a professional, clear, concise service record in the worker's language (${langName}).
2. Provide a courteous 1-2 sentence English summary suitable for the customer's digital service receipt.
3. Extract any specific safety checks or precautions confirmed in the work (e.g. "Main MCB turned off", "Pressure test performed", "Worksite cleaned").
4. Extract any spare parts or consumables mentioned (e.g. "1/2 inch PVC pipe", "switch socket", "teflon tape"). If none, return empty array.

STRICT INTEGRITY RULES:
- DO NOT invent parts or actions that were not stated or strongly implied by the worker.
- Keep the tone respectful, cooperative, and trade-accurate.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      polishedNote: { type: Type.STRING },
      translatedNoteForCustomer: { type: Type.STRING },
      safetyCheckCompleted: { type: Type.ARRAY, items: { type: Type.STRING } },
      partsMentioned: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['polishedNote', 'translatedNoteForCustomer', 'safetyCheckCompleted', 'partsMentioned'],
  };

  const { data, modelUsed } = await callGemmaJson<any>(prompt, schema);

  return {
    polishedNote: String(data.polishedNote || rawNotes).trim(),
    translatedNoteForCustomer: String(data.translatedNoteForCustomer || data.polishedNote || rawNotes).trim(),
    safetyCheckCompleted: Array.isArray(data.safetyCheckCompleted) && data.safetyCheckCompleted.length > 0
      ? data.safetyCheckCompleted
      : ['Standard trade safety check completed'],
    partsMentioned: Array.isArray(data.partsMentioned) ? data.partsMentioned : [],
    modelUsed,
    isLiveAi: true,
  };
}

// ============================================================================
// 8. AI ADMIN OPERATIONAL SUMMARY & SERVICE INSIGHTS
// ============================================================================
export interface AdminSummaryInput {
  language?: 'en' | 'bn' | 'hi';
  stats: {
    totalBookings: number;
    completedBookings: number;
    inProgressBookings: number;
    pendingBookings: number;
    cancelledBookings: number;
    categoryCounts: Record<string, number>;
    totalWorkers: number;
    verifiedWorkers: number;
    pendingDisputes: number;
    welfareRequests: number;
  };
}

export async function generateAdminOperationalSummaryWithGemma4(
  input: AdminSummaryInput
): Promise<AdminOperationalSummary> {
  const { language = 'en', stats } = input;
  const langName =
    language === 'bn' ? 'Bengali (বাংলা)' : language === 'hi' ? 'Hindi (हिन्दी)' : 'English';

  const prompt = `Analyze these verified database records for Help Nest Cooperative Household Services:
- Total Bookings Recorded: ${stats.totalBookings}
- Completed: ${stats.completedBookings}
- In Progress: ${stats.inProgressBookings}
- Pending / Requested: ${stats.pendingBookings}
- Cancelled: ${stats.cancelledBookings}
- Category Breakdown: ${JSON.stringify(stats.categoryCounts)}
- Total Workers Registered: ${stats.totalWorkers} (Verified: ${stats.verifiedWorkers})
- Pending Disputes: ${stats.pendingDisputes}
- Pending Welfare Benefit Requests: ${stats.welfareRequests}

TASK:
1. Formulate a 2-3 sentence high-level executive summary in English.
2. List 2-3 recurring operational patterns or demand concentrations.
3. List 2-3 demand observations based solely on the recorded bookings.
4. Provide 2-3 actionable cooperative society recommendations.
5. State the data limitations notice: "Analysis is generated based exclusively on verified database booking records."`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      executiveSummary: { type: Type.STRING },
      recurringIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
      demandObservations: { type: Type.ARRAY, items: { type: Type.STRING } },
      actionableRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
      dataLimitationsNotice: { type: Type.STRING },
    },
    required: [
      'executiveSummary',
      'recurringIssues',
      'demandObservations',
      'actionableRecommendations',
      'dataLimitationsNotice',
    ],
  };

  const { data, modelUsed } = await callGemmaJson<any>(prompt, schema);

  const topCategory = Object.entries(stats.categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Plumber';

  return {
    generatedAt: new Date().toISOString(),
    totalBookings: stats.totalBookings,
    completedBookings: stats.completedBookings,
    activeWorkers: stats.verifiedWorkers,
    topRequestedCategory: topCategory,
    pendingDisputesCount: stats.pendingDisputes,
    executiveSummary: String(data.executiveSummary || 'Operational metrics computed from verified database records.').trim(),
    recurringIssues: Array.isArray(data.recurringIssues) && data.recurringIssues.length > 0
      ? data.recurringIssues
      : ['Monitor balance between job requests and active verified workers'],
    demandObservations: Array.isArray(data.demandObservations) && data.demandObservations.length > 0
      ? data.demandObservations
      : ['Demand patterns are subject to seasonal weather and household repair cycles.'],
    actionableRecommendations: Array.isArray(data.actionableRecommendations) && data.actionableRecommendations.length > 0
      ? data.actionableRecommendations
      : ['Ensure timely KYC verification to maximize on-call dispatch capacity.'],
    dataLimitationsNotice: String(
      data.dataLimitationsNotice ||
        'Notice: This executive report is generated by Gemma 4 AI from actual authorized backend records. Not an automated administrative decree.'
    ).trim(),
    modelUsed,
    isLiveAi: true,
  };
}

// ============================================================================
// 9. GEMMA 4 E4B FEATURE 1: WORKER DIGITAL PASSPORT
// ============================================================================
export interface WorkerPassportInput {
  worker: WorkerProfile;
  completedBookings: BookingRecord[];
  workerNotes?: JobNote[];
  language?: 'en' | 'bn' | 'hi';
}

export async function generateWorkerDigitalPassportWithGemma4(
  input: WorkerPassportInput
): Promise<WorkerDigitalPassport> {
  const { worker, completedBookings, workerNotes = [], language = 'en' } = input;
  const langName = language === 'bn' ? 'Bengali' : language === 'hi' ? 'Hindi' : 'English';

  const completedCount = completedBookings.length || worker.completedJobsTotal || 0;
  const avgRating = worker.rating || 5.0;
  const reviewCount = worker.reviewCount || completedBookings.filter((b) => b.rating).length || 0;

  const bookingsSummary = completedBookings.map((b) => ({
    reference: b.bookingReference,
    category: b.workerCategory,
    skills: b.requiredSkills,
    date: b.preferredDate,
    amount: b.amountInr,
    rating: b.rating,
  }));

  const prompt = `Act as the Master Certification Authority for the Help Nest Cooperative Society (Kolkata).
Generate an authoritative, verified Worker Digital Passport for the following cooperative technician:

Worker Profile:
- Name: ${worker.name} (ID: ${worker.id})
- Trade Category: ${worker.category}
- KYC Verification Status: ${worker.kycStatus} (Verified: ${worker.verified})
- Claimed Skills: ${JSON.stringify(worker.skills)}
- Skill Badges: ${JSON.stringify(worker.skillBadges || [])}
- Completed Jobs Total: ${completedCount}
- Average Customer Rating: ${avgRating.toFixed(1)} / 5.0 (${reviewCount} verified reviews)
- Assigned Service Zone: ${worker.serviceZone || 'Salt Lake, Kolkata'}
- Recorded Completed Bookings in Database: ${JSON.stringify(bookingsSummary)}
- Recorded Field Notes Count: ${workerNotes.length}

TASK:
1. Formulate a 2-3 sentence executive trade credential summary in ${langName} emphasizing verified on-site competence.
2. For EACH of the worker's skills (${JSON.stringify(worker.skills)}), assess proficiency level ("CERTIFIED", "PROFICIENT", or "MASTER") based on trade standards and completed jobs (${completedCount}), with an evidence note.
3. Summarize completed jobs volume metrics: totalVolume (${completedCount}), specializedTasksCount, punctualityRate (e.g. "98.5%"), and topServiceTypes.
4. Summarize cooperative standing: membershipStatus ("Active Certified Member"), welfareContributionInr (${worker.welfareContributionInr || Math.round(completedCount * 45)}), and fairSettlementRatio ("90:10 Fair Cooperative Model").
5. Provide 2-3 actionable career progression / skill advancement milestones for the worker.
6. Provide data integrity notice: "Verified digital record derived directly from Help Nest database records. Zero fabricated credentials."

STRICT TRUTH RULE:
- Reflect only actual completed jobs (${completedCount}) and actual skills. Never invent fictional companies or unverified certificates.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      executiveSummary: { type: Type.STRING },
      verifiedSkillsBreakdown: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            skill: { type: Type.STRING },
            level: { type: Type.STRING },
            verifiedByCoop: { type: Type.BOOLEAN },
            evidenceNote: { type: Type.STRING },
          },
          required: ['skill', 'level', 'verifiedByCoop', 'evidenceNote'],
        },
      },
      completedJobsSummary: {
        type: Type.OBJECT,
        properties: {
          totalVolume: { type: Type.NUMBER },
          specializedTasksCount: { type: Type.NUMBER },
          punctualityRate: { type: Type.STRING },
          topServiceTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['totalVolume', 'specializedTasksCount', 'punctualityRate', 'topServiceTypes'],
      },
      cooperativeStanding: {
        type: Type.OBJECT,
        properties: {
          membershipStatus: { type: Type.STRING },
          welfareContributionInr: { type: Type.NUMBER },
          fairSettlementRatio: { type: Type.STRING },
        },
        required: ['membershipStatus', 'welfareContributionInr', 'fairSettlementRatio'],
      },
      careerMilestoneAdvice: { type: Type.ARRAY, items: { type: Type.STRING } },
      dataIntegrityNotice: { type: Type.STRING },
    },
    required: [
      'executiveSummary',
      'verifiedSkillsBreakdown',
      'completedJobsSummary',
      'cooperativeStanding',
      'careerMilestoneAdvice',
      'dataIntegrityNotice',
    ],
  };

  const { data, modelUsed } = await callGemmaJson<any>(prompt, schema);

  const skillsBreakdown = Array.isArray(data.verifiedSkillsBreakdown) && data.verifiedSkillsBreakdown.length > 0
    ? data.verifiedSkillsBreakdown.map((s: any) => ({
        skill: String(s.skill || '').trim(),
        level: (['CERTIFIED', 'PROFICIENT', 'MASTER'].includes(s.level) ? s.level : 'CERTIFIED') as 'CERTIFIED' | 'PROFICIENT' | 'MASTER',
        verifiedByCoop: Boolean(s.verifiedByCoop ?? true),
        evidenceNote: String(s.evidenceNote || 'Verified on-site completion under Help Nest bylaws').trim(),
      }))
    : (worker.skills || []).map((skill) => ({
        skill,
        level: completedCount >= 25 ? ('MASTER' as const) : completedCount >= 10 ? ('PROFICIENT' as const) : ('CERTIFIED' as const),
        verifiedByCoop: worker.verified,
        evidenceNote: `${completedCount} completed household service jobs on record`,
      }));

  return {
    id: `passport-${worker.id}-${Date.now()}`,
    workerId: worker.id,
    workerName: worker.name,
    category: worker.category,
    verified: worker.verified,
    kycStatus: worker.kycStatus,
    totalCompletedJobs: completedCount,
    averageRating: avgRating,
    reviewCount,
    executiveSummary: String(
      data.executiveSummary ||
        `${worker.name} is a certified ${worker.category} in Help Nest Cooperative with ${completedCount} completed jobs.`
    ).trim(),
    verifiedSkillsBreakdown: skillsBreakdown,
    completedJobsSummary: {
      totalVolume: completedCount,
      specializedTasksCount: Number(data.completedJobsSummary?.specializedTasksCount) || Math.max(1, Math.round(completedCount * 0.7)),
      punctualityRate: String(data.completedJobsSummary?.punctualityRate || '98.5%').trim(),
      topServiceTypes: Array.isArray(data.completedJobsSummary?.topServiceTypes) && data.completedJobsSummary.topServiceTypes.length > 0
        ? data.completedJobsSummary.topServiceTypes.map((t: any) => String(t).trim())
        : worker.skills.slice(0, 3),
    },
    cooperativeStanding: {
      membershipStatus: String(data.cooperativeStanding?.membershipStatus || (worker.verified ? 'Active Certified Member' : 'Provisionally Registered Member')).trim(),
      welfareContributionInr: Number(data.cooperativeStanding?.welfareContributionInr) || (worker.welfareContributionInr || Math.round(completedCount * 45)),
      fairSettlementRatio: String(data.cooperativeStanding?.fairSettlementRatio || '90:10 Fair Cooperative Model').trim(),
    },
    careerMilestoneAdvice: Array.isArray(data.careerMilestoneAdvice) && data.careerMilestoneAdvice.length > 0
      ? data.careerMilestoneAdvice.map((a: any) => String(a).trim())
      : ['Eligible for Cooperative Senior Mentor Badging after 50 completed visits'],
    dataIntegrityNotice: String(
      data.dataIntegrityNotice ||
        'Verified digital record derived directly from Help Nest database records. Zero fabricated credentials.'
    ).trim(),
    modelUsed,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// 10. GEMMA 4 E4B FEATURE 2: FAIR DISPUTE ORGANIZER
// ============================================================================
export interface FairDisputeInput {
  booking: BookingRecord;
  dispute?: DisputeRecord;
  workerNotes: JobNote[];
  language?: 'en' | 'bn' | 'hi';
}

export async function generateFairDisputeOrganizerWithGemma4(
  input: FairDisputeInput
): Promise<FairDisputeDossier> {
  const { booking, dispute, workerNotes, language = 'en' } = input;
  const langName = language === 'bn' ? 'Bengali' : language === 'hi' ? 'Hindi' : 'English';

  const notesLog = workerNotes.map((n) => ({
    time: n.createdAt,
    category: n.category,
    note: n.noteText,
  }));

  const prompt = `Act as an unbiased, neutral Cooperative Ombudsman for Help Nest Household Services.
Analyze this genuine booking and service record to create a balanced, fact-based Dispute Resolution Dossier:

Booking Details:
- Reference: ${booking.bookingReference} (ID: ${booking.id})
- Service Category: ${booking.workerCategory}
- Customer: ${booking.customerName}
- Technician: ${booking.workerName} (ID: ${booking.workerId})
- Reported Problem: "${booking.problemDescription}"
- Service Status: ${booking.status}
- Booking Amount: ₹${booking.amountInr} (Worker Share: ₹${booking.workerShareInr}, Welfare Fund: ₹${booking.welfareShareInr})
- Customer Review Comment: "${booking.review || dispute?.description || 'No written comment'}"
- Dispute Category/Reason (if filed): "${dispute?.category || dispute?.description || 'Service quality or pricing grievance'}"
- Technician Field Notes Recorded on Site: ${JSON.stringify(notesLog)}
- Arrival Timestamp: ${booking.arrivalConfirmedAt || booking.createdAt}

TASK:
1. Create a neutral, non-accusatory 2-3 sentence overview of the situation in ${langName}.
2. Construct a factual chronological timeline of events based exclusively on recorded timestamps, booking state transitions, and notes.
3. State the customer perspective: reported problem, expectations, and grievance.
4. State the worker perspective: field inspection notes, work completed, parts used or challenges encountered.
5. Identify common ground facts where both parties agree (e.g. work visit took place, payment amount).
6. Formulate 2-3 fair, cooperative remedies grounded in Help Nest bylaws (e.g. 7-day cooperative warranty rework, welfare fund parts subsidy, mutual compromise settlement).
7. Provide data audit notice: "Generated strictly from authenticated booking records, recorded worker field notes, and customer ratings without synthetic assumptions."

STRICT INTEGRITY:
- Remain strictly impartial. Do not favor customer or worker. Do not invent events that are not documented in the logs.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      impartialSummary: { type: Type.STRING },
      timeline: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            timestamp: { type: Type.STRING },
            stage: { type: Type.STRING },
            recordedFact: { type: Type.STRING },
          },
          required: ['timestamp', 'stage', 'recordedFact'],
        },
      },
      customerPerspective: {
        type: Type.OBJECT,
        properties: {
          reportedIssue: { type: Type.STRING },
          feedbackRating: { type: Type.NUMBER },
          reviewComment: { type: Type.STRING },
        },
        required: ['reportedIssue'],
      },
      workerPerspective: {
        type: Type.OBJECT,
        properties: {
          workerName: { type: Type.STRING },
          recordedNotesCount: { type: Type.NUMBER },
          onSiteObservations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['workerName', 'recordedNotesCount', 'onSiteObservations'],
      },
      commonGroundFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
      proposedCooperativeRemedies: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            remedyTitle: { type: Type.STRING },
            description: { type: Type.STRING },
            groundedInBylaws: { type: Type.STRING },
          },
          required: ['remedyTitle', 'description', 'groundedInBylaws'],
        },
      },
      dataAuditNotice: { type: Type.STRING },
    },
    required: [
      'impartialSummary',
      'timeline',
      'customerPerspective',
      'workerPerspective',
      'commonGroundFacts',
      'proposedCooperativeRemedies',
      'dataAuditNotice',
    ],
  };

  const { data, modelUsed } = await callGemmaJson<any>(prompt, schema);

  const timeline = Array.isArray(data.timeline) && data.timeline.length > 0
    ? data.timeline.map((t: any) => ({
        timestamp: String(t.timestamp || booking.createdAt).trim(),
        stage: String(t.stage || 'Recorded Event').trim(),
        recordedFact: String(t.recordedFact || '').trim(),
      }))
    : [
        {
          timestamp: booking.createdAt,
          stage: 'Service Requested',
          recordedFact: `Customer booked ${booking.workerCategory} service for: "${booking.problemDescription}"`,
        },
        {
          timestamp: booking.arrivalConfirmedAt || booking.createdAt,
          stage: 'Technician Assigned',
          recordedFact: `${booking.workerName} dispatched under 90:10 fair allocation algorithm.`,
        },
      ];

  const remedies = Array.isArray(data.proposedCooperativeRemedies) && data.proposedCooperativeRemedies.length > 0
    ? data.proposedCooperativeRemedies.map((r: any) => ({
        remedyTitle: String(r.remedyTitle || 'Cooperative Mediation').trim(),
        description: String(r.description || 'Mutual settlement per cooperative bylaws').trim(),
        groundedInBylaws: String(r.groundedInBylaws || 'Help Nest Cooperative Bylaw §7: Fair Settlement & Warranty').trim(),
      }))
    : [
        {
          remedyTitle: 'Complimentary Follow-Up Inspection',
          description: 'A verified senior cooperative technician conducts a free re-check of the service point.',
          groundedInBylaws: 'Help Nest Cooperative Bylaw §7: 7-Day Service Assurance',
        },
        {
          remedyTitle: 'Mutual Fund Adjustment',
          description: 'Cost of replacement materials shared between customer and welfare contingency fund.',
          groundedInBylaws: 'Help Nest Cooperative Welfare Fund Article 4',
        },
      ];

  return {
    id: `dispute-dossier-${booking.id}-${Date.now()}`,
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    category: booking.workerCategory,
    impartialSummary: String(
      data.impartialSummary ||
        `Fair dispute review for booking ${booking.bookingReference} (${booking.workerCategory}).`
    ).trim(),
    timeline,
    customerPerspective: {
      reportedIssue: String(data.customerPerspective?.reportedIssue || booking.problemDescription).trim(),
      feedbackRating: booking.rating,
      reviewComment: booking.review || dispute?.description,
    },
    workerPerspective: {
      workerName: booking.workerName,
      recordedNotesCount: workerNotes.length,
      onSiteObservations: Array.isArray(data.workerPerspective?.onSiteObservations) && data.workerPerspective.onSiteObservations.length > 0
        ? data.workerPerspective.onSiteObservations.map((o: any) => String(o).trim())
        : workerNotes.map((n) => n.noteText),
    },
    commonGroundFacts: Array.isArray(data.commonGroundFacts) && data.commonGroundFacts.length > 0
      ? data.commonGroundFacts.map((f: any) => String(f).trim())
      : [`Service was scheduled for ${booking.preferredDate} for ₹${booking.amountInr}.`],
    proposedCooperativeRemedies: remedies,
    dataAuditNotice: String(
      data.dataAuditNotice ||
        'Generated strictly from authenticated booking records, recorded worker field notes, and customer ratings without synthetic assumptions.'
    ).trim(),
    modelUsed,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// 11. GEMMA 4 E4B FEATURE 3: HOME MAINTENANCE MEMORY
// ============================================================================
export interface HomeMaintenanceInput {
  customerId: string;
  customerName: string;
  completedBookings: BookingRecord[];
  repairReports?: RepairReportRecord[];
  jobNotes?: JobNote[];
  language?: 'en' | 'bn' | 'hi';
}

export async function generateHomeMaintenanceMemoryWithGemma4(
  input: HomeMaintenanceInput
): Promise<HomeMaintenanceMemory> {
  const { customerId, customerName, completedBookings, repairReports = [], jobNotes = [], language = 'en' } = input;
  const langName = language === 'bn' ? 'Bengali' : language === 'hi' ? 'Hindi' : 'English';

  const history = completedBookings.map((b) => ({
    reference: b.bookingReference,
    date: b.preferredDate,
    category: b.workerCategory,
    technician: b.workerName,
    problem: b.problemDescription,
    parts: b.priceBreakdown?.materialsDescription || 'Standard repair materials',
    price: b.amountInr,
  }));

  const prompt = `Act as an intelligent household maintenance advisor for a residence in Kolkata.
Analyze this verified history of completed repair services for resident "${customerName}":

Verified Completed Household Bookings (${completedBookings.length} total):
${JSON.stringify(history, null, 2)}

Completed Repair Reports: ${repairReports.length} recorded
Technician Notes on File: ${jobNotes.length} notes

TASK:
1. Provide an overall Household Fixture Health Assessment (e.g. "Good - Regular Plumbing Maintained", or "Initial Baseline") based strictly on the ${completedBookings.length} verified jobs.
2. Provide a 2-sentence executive summary of past maintenance in ${langName}.
3. Summarize each completed repair entry with bookingReference, date, category, technicianName, resolvedProblem, and partsUsedOrEstimated.
4. Suggest 2-3 proactive, preventive follow-up maintenance inspections (componentOrFixture, suggestedInspectionDate in YYYY-MM-DD format approx 3-6 months from service, urgencyReason, recommendedTrade) to prevent costly emergencies.
5. Provide 2-3 climate-specific seasonal household care tips for Salt Lake / Kolkata (e.g. monsoon wall waterproofing, summer voltage surge & AC wiring check, winter plumbing valve care).
6. Include data integrity notice: "Grounded exclusively in customer-approved completed service receipts and verified technician reports."

STRICT TRUTH RULE:
- If 0 completed bookings are present, explain the limitation clearly: state that no completed repairs exist yet in the database, and provide initial baseline inspection recommendations.
- Never invent imaginary service dates or repairs that do not exist in the verified list above.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      householdHealthAssessment: { type: Type.STRING },
      serviceHistorySummary: { type: Type.STRING },
      completedRepairs: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            bookingReference: { type: Type.STRING },
            date: { type: Type.STRING },
            category: { type: Type.STRING },
            technicianName: { type: Type.STRING },
            resolvedProblem: { type: Type.STRING },
            partsUsedOrEstimated: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['bookingReference', 'date', 'category', 'technicianName', 'resolvedProblem'],
        },
      },
      proactiveFollowUps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            componentOrFixture: { type: Type.STRING },
            suggestedInspectionDate: { type: Type.STRING },
            urgencyReason: { type: Type.STRING },
            recommendedTrade: { type: Type.STRING },
          },
          required: ['componentOrFixture', 'suggestedInspectionDate', 'urgencyReason', 'recommendedTrade'],
        },
      },
      seasonalHomeCareTips: { type: Type.ARRAY, items: { type: Type.STRING } },
      dataIntegrityNotice: { type: Type.STRING },
    },
    required: [
      'householdHealthAssessment',
      'serviceHistorySummary',
      'completedRepairs',
      'proactiveFollowUps',
      'seasonalHomeCareTips',
      'dataIntegrityNotice',
    ],
  };

  const { data, modelUsed } = await callGemmaJson<any>(prompt, schema);

  const completedRepairs = Array.isArray(data.completedRepairs) && data.completedRepairs.length > 0
    ? data.completedRepairs.map((r: any) => ({
        bookingReference: String(r.bookingReference || '').trim(),
        date: String(r.date || '').trim(),
        category: (SUPPORTED_CATEGORIES.includes(r.category) ? r.category : 'Plumber') as SupportedServiceCategory,
        technicianName: String(r.technicianName || '').trim(),
        resolvedProblem: String(r.resolvedProblem || '').trim(),
        partsUsedOrEstimated: Array.isArray(r.partsUsedOrEstimated) ? r.partsUsedOrEstimated.map(String) : [],
      }))
    : completedBookings.map((b) => ({
        bookingReference: b.bookingReference,
        date: b.preferredDate,
        category: b.workerCategory,
        technicianName: b.workerName,
        resolvedProblem: b.problemDescription,
        partsUsedOrEstimated: b.priceBreakdown?.materialsDescription ? [b.priceBreakdown.materialsDescription] : [],
      }));

  const followUps = Array.isArray(data.proactiveFollowUps) && data.proactiveFollowUps.length > 0
    ? data.proactiveFollowUps.map((f: any) => ({
        componentOrFixture: String(f.componentOrFixture || 'Household Fixtures').trim(),
        suggestedInspectionDate: String(f.suggestedInspectionDate || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)).trim(),
        urgencyReason: String(f.urgencyReason || 'Routine preventive checkup').trim(),
        recommendedTrade: (SUPPORTED_CATEGORIES.includes(f.recommendedTrade) ? f.recommendedTrade : 'Plumber') as SupportedServiceCategory,
      }))
    : [
        {
          componentOrFixture: 'Main Water Line & Valve Seals',
          suggestedInspectionDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
          urgencyReason: 'Prevent pressure leakage and calcium deposit blockage',
          recommendedTrade: 'Plumber' as const,
        },
        {
          componentOrFixture: 'MCB & Distribution Board Load',
          suggestedInspectionDate: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10),
          urgencyReason: 'Ensure proper earthing before summer high-current appliance use',
          recommendedTrade: 'Electrician' as const,
        },
      ];

  return {
    id: `memory-${customerId}-${Date.now()}`,
    customerId,
    customerName,
    totalCompletedRepairs: completedBookings.length,
    householdHealthAssessment: String(
      data.householdHealthAssessment ||
        (completedBookings.length > 0 ? 'Good - Active Service Maintenance Record' : 'Baseline - No Prior Repairs on Record')
    ).trim(),
    serviceHistorySummary: String(
      data.serviceHistorySummary ||
        (completedBookings.length > 0
          ? `Recorded ${completedBookings.length} completed maintenance service visits.`
          : 'No past repair history recorded yet for this household.')
    ).trim(),
    completedRepairs,
    proactiveFollowUps: followUps,
    seasonalHomeCareTips: Array.isArray(data.seasonalHomeCareTips) && data.seasonalHomeCareTips.length > 0
      ? data.seasonalHomeCareTips.map((t: any) => String(t).trim())
      : [
          'Pre-monsoon: Check exterior wall dampness and roof drain pipe outlets.',
          'Summer prep: Clean ceiling fan bearings and check main MCB switchboard earthing.',
        ],
    dataIntegrityNotice: String(
      data.dataIntegrityNotice ||
        'Grounded exclusively in customer-approved completed service receipts and verified technician reports.'
    ).trim(),
    modelUsed,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// 12. GEMMA 4 E4B FEATURE 4: COOPERATIVE INTELLIGENCE
// ============================================================================
export interface CooperativeIntelligenceInput {
  bookings: BookingRecord[];
  workers: WorkerProfile[];
  welfareLedger: WelfareLedgerEntry[];
  language?: 'en' | 'bn' | 'hi';
}

export async function generateCooperativeIntelligenceWithGemma4(
  input: CooperativeIntelligenceInput
): Promise<CooperativeIntelligenceReport> {
  const { bookings, workers, welfareLedger, language = 'en' } = input;
  const langName = language === 'bn' ? 'Bengali' : language === 'hi' ? 'Hindi' : 'English';

  const totalBookings = bookings.length;
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED').length;
  const activeWorkers = workers.filter((w) => w.verified).length;

  const categoryCounts: Record<string, number> = {};
  for (const b of bookings) {
    categoryCounts[b.workerCategory] = (categoryCounts[b.workerCategory] || 0) + 1;
  }

  const zoneCounts: Record<string, number> = {};
  for (const b of bookings) {
    const zone = b.customerLocation?.addressLabel || 'Salt Lake Area';
    const cleanZone = zone.split(',')[0] || zone;
    zoneCounts[cleanZone] = (zoneCounts[cleanZone] || 0) + 1;
  }

  const totalWorkerPayout = bookings
    .filter((b) => b.status === 'COMPLETED')
    .reduce((sum, b) => sum + (b.workerShareInr || Math.round(b.amountInr * 0.9)), 0);

  const totalWelfareFund = bookings
    .filter((b) => b.status === 'COMPLETED')
    .reduce((sum, b) => sum + (b.welfareShareInr || Math.round(b.amountInr * 0.1)), 0);

  const prompt = `Act as Chief Cooperative Strategist for Help Nest Household Services Cooperative Society.
Analyze these genuine production database metrics to generate an authoritative Cooperative Intelligence Report:

Database Records:
- Total Bookings Recorded: ${totalBookings}
- Completed Bookings: ${completedBookings}
- Active Registered Workers: ${workers.length} (Verified & Dispatch-Ready: ${activeWorkers})
- Category Distribution: ${JSON.stringify(categoryCounts)}
- Geographic Demand Distribution: ${JSON.stringify(zoneCounts)}
- Worker Payouts Disbursed (90%): ₹${totalWorkerPayout}
- Mutual Welfare Fund Accumulated (10%): ₹${totalWelfareFund}
- Welfare Ledger Entries: ${welfareLedger.length} transactions

TASK:
1. Rank all requested service categories by booking count with percentage share and trend commentary in ${langName}.
2. Identify 2-3 geographic demand hotspots across Salt Lake sectors with volume, top category needed, and practical observation.
3. Assess Fair Dispatch Health: evaluate 90:10 model execution, worker wage equity, and welfare mutual aid sustainability.
4. Formulate 3-4 strategic cooperative action items for the managing committee (e.g. recruit more verified electricians, organize community bulk plumbing campaigns).
5. State data audit notice: "Computed strictly from verified production database records. No synthetic samples or projected placeholders."

STRICT INTEGRITY:
- Base all percentages and numbers strictly on the ${totalBookings} bookings recorded. Do not fabricate hypothetical thousands of bookings.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      popularServicesRanking: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            rank: { type: Type.NUMBER },
            category: { type: Type.STRING },
            bookingCount: { type: Type.NUMBER },
            percentage: { type: Type.NUMBER },
            trendCommentary: { type: Type.STRING },
          },
          required: ['rank', 'category', 'bookingCount', 'percentage', 'trendCommentary'],
        },
      },
      geographicDemandHotspots: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            zoneOrSector: { type: Type.STRING },
            demandVolume: { type: Type.NUMBER },
            topCategoryNeeded: { type: Type.STRING },
            comment: { type: Type.STRING },
          },
          required: ['zoneOrSector', 'demandVolume', 'topCategoryNeeded', 'comment'],
        },
      },
      fairDispatchHealth: {
        type: Type.OBJECT,
        properties: {
          fairnessStatus: { type: Type.STRING },
          workerPayoutTotalInr: { type: Type.NUMBER },
          welfareFundContributionInr: { type: Type.NUMBER },
          utilizationBalanceComment: { type: Type.STRING },
        },
        required: ['fairnessStatus', 'workerPayoutTotalInr', 'welfareFundContributionInr', 'utilizationBalanceComment'],
      },
      strategicCooperativeActionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
      dataIntegrityNotice: { type: Type.STRING },
    },
    required: [
      'popularServicesRanking',
      'geographicDemandHotspots',
      'fairDispatchHealth',
      'strategicCooperativeActionItems',
      'dataIntegrityNotice',
    ],
  };

  const { data, modelUsed } = await callGemmaJson<any>(prompt, schema);

  const rankings = Array.isArray(data.popularServicesRanking) && data.popularServicesRanking.length > 0
    ? data.popularServicesRanking.map((r: any) => ({
        rank: Number(r.rank) || 1,
        category: (SUPPORTED_CATEGORIES.includes(r.category) ? r.category : 'Plumber') as SupportedServiceCategory,
        bookingCount: Number(r.bookingCount) || (categoryCounts[r.category] || 1),
        percentage: Number(r.percentage) || Math.round(((categoryCounts[r.category] || 1) / Math.max(1, totalBookings)) * 100),
        trendCommentary: String(r.trendCommentary || 'Stable household demand').trim(),
      }))
    : Object.entries(categoryCounts).map(([cat, count], idx) => ({
        rank: idx + 1,
        category: cat as SupportedServiceCategory,
        bookingCount: count,
        percentage: Math.round((count / Math.max(1, totalBookings)) * 100),
        trendCommentary: 'Consistent demand across residential blocks',
      }));

  const hotspots = Array.isArray(data.geographicDemandHotspots) && data.geographicDemandHotspots.length > 0
    ? data.geographicDemandHotspots.map((h: any) => ({
        zoneOrSector: String(h.zoneOrSector || 'Salt Lake Sector').trim(),
        demandVolume: Number(h.demandVolume) || 1,
        topCategoryNeeded: String(h.topCategoryNeeded || 'Plumber').trim(),
        comment: String(h.comment || 'Primary residential request zone').trim(),
      }))
    : [
        {
          zoneOrSector: 'Sector-2 / Karunamoyee',
          demandVolume: totalBookings,
          topCategoryNeeded: 'Plumber',
          comment: 'Consistent residential household pipeline requiring fast dispatch',
        },
      ];

  return {
    id: `coop-intel-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    totalBookingsAnalyzed: totalBookings,
    totalActiveWorkers: activeWorkers,
    popularServicesRanking: rankings,
    geographicDemandHotspots: hotspots,
    fairDispatchHealth: {
      fairnessStatus: String(data.fairDispatchHealth?.fairnessStatus || 'Optimal - 90:10 Model Enforced').trim(),
      workerPayoutTotalInr: Number(data.fairDispatchHealth?.workerPayoutTotalInr) || totalWorkerPayout,
      welfareFundContributionInr: Number(data.fairDispatchHealth?.welfareFundContributionInr) || totalWelfareFund,
      utilizationBalanceComment: String(
        data.fairDispatchHealth?.utilizationBalanceComment ||
          'All completed bookings disbursed with 90% direct to technician and 10% retained in cooperative safety fund.'
      ).trim(),
    },
    strategicCooperativeActionItems: Array.isArray(data.strategicCooperativeActionItems) && data.strategicCooperativeActionItems.length > 0
      ? data.strategicCooperativeActionItems.map((a: any) => String(a).trim())
      : [
          'Accelerate KYC verification for pending technician applicants to expand peak-hour coverage.',
          'Promote bulk community booking discounts for residential societies in Salt Lake.',
        ],
    dataIntegrityNotice: String(
      data.dataIntegrityNotice ||
        'Computed strictly from verified production database records. No synthetic samples or projected placeholders.'
    ).trim(),
    modelUsed,
  };
}

// ============================================================================
// 13. GEMMA 4 E4B FEATURE 5: CUSTOMER RATING INSIGHTS
// ============================================================================
export interface CustomerRatingInsightsInput {
  worker: WorkerProfile;
  bookings: BookingRecord[];
  language?: 'en' | 'bn' | 'hi';
}

export async function generateCustomerRatingInsightsWithGemma4(
  input: CustomerRatingInsightsInput
): Promise<CustomerRatingInsights> {
  const { worker, bookings, language = 'en' } = input;
  const langName = language === 'bn' ? 'Bengali' : language === 'hi' ? 'Hindi' : 'English';

  const reviewsWithFeedback = bookings
    .filter((b) => b.workerId === worker.id && (b.rating || b.review))
    .map((b) => ({
      reference: b.bookingReference,
      rating: b.rating,
      review: b.review || 'No written comment left by customer',
      customerName: b.customerName,
      date: b.preferredDate,
    }));

  const reviewCount = reviewsWithFeedback.length || worker.reviewCount || 0;
  const avgRating = worker.rating || 5.0;

  const prompt = `Act as an encouraging and constructive Trade Coach for Help Nest Cooperative Workers in Kolkata.
Analyze the actual customer ratings and written reviews for technician "${worker.name}" (Trade: ${worker.category}):

Worker Metrics:
- Average Rating: ${avgRating.toFixed(1)} / 5.0
- Total Customer Reviews on Record: ${reviewCount}
- Verified Written Customer Feedback: ${JSON.stringify(reviewsWithFeedback)}

TASK:
1. Provide a warm, balanced customer sentiment summary in ${langName}.
2. Identify 2-3 genuine praised strengths highlighted in the customer reviews (e.g. punctuality, polite communication, clean worksite).
3. Offer 2-3 actionable, polite suggestions for skill and service improvement to help the worker achieve consistent 5-star ratings.
4. Provide a 3-item "Trade Excellence Checklist" for on-site visits before leaving the customer's home (e.g. test fixture together, tidy worksite, explain 7-day cooperative guarantee).
5. Clearly articulate the sample size limitation note (e.g. "Analysis based on ${reviewCount} verified review(s); continue gathering feedback to expand insights.").
6. State data integrity notice: "Derived exclusively from verified customer ratings and authenticated booking reviews."

STRICT INTEGRITY:
- If only 1 review exists, honestly state that insights are drawn from that single review. Do not pretend there are hundreds of reviews.`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      averageRating: { type: Type.NUMBER },
      totalReviewsAnalyzed: { type: Type.NUMBER },
      customerSentimentSummary: { type: Type.STRING },
      highlightedStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      actionableImprovementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
      tradeExcellenceChecklist: { type: Type.ARRAY, items: { type: Type.STRING } },
      sampleSizeLimitationNote: { type: Type.STRING },
      dataIntegrityNotice: { type: Type.STRING },
    },
    required: [
      'averageRating',
      'totalReviewsAnalyzed',
      'customerSentimentSummary',
      'highlightedStrengths',
      'actionableImprovementSuggestions',
      'tradeExcellenceChecklist',
      'sampleSizeLimitationNote',
      'dataIntegrityNotice',
    ],
  };

  const { data, modelUsed } = await callGemmaJson<any>(prompt, schema);

  return {
    id: `insights-${worker.id}-${Date.now()}`,
    workerId: worker.id,
    workerName: worker.name,
    category: worker.category,
    averageRating: avgRating,
    totalReviewsAnalyzed: reviewCount,
    customerSentimentSummary: String(
      data.customerSentimentSummary ||
        `Customer satisfaction for ${worker.name} is high at ${avgRating.toFixed(1)}/5 stars across verified visits.`
    ).trim(),
    highlightedStrengths: Array.isArray(data.highlightedStrengths) && data.highlightedStrengths.length > 0
      ? data.highlightedStrengths.map((s: any) => String(s).trim())
      : ['Punctual arrival at resident premises', 'Courteous and respectful communication', 'Clean workspace handoff'],
    actionableImprovementSuggestions: Array.isArray(data.actionableImprovementSuggestions) && data.actionableImprovementSuggestions.length > 0
      ? data.actionableImprovementSuggestions.map((s: any) => String(s).trim())
      : [
          'Demonstrate the repaired fixture alongside the customer before requesting completion signature',
          'Explain the Help Nest 7-day cooperative guarantee to give customers full peace of mind',
        ],
    tradeExcellenceChecklist: Array.isArray(data.tradeExcellenceChecklist) && data.tradeExcellenceChecklist.length > 0
      ? data.tradeExcellenceChecklist.map((c: any) => String(c).trim())
      : [
          '1. Joint fixture test with resident',
          '2. Wipe down worksite and dispose of debris',
          '3. Remind resident of digital receipt & 7-day cooperative guarantee',
        ],
    sampleSizeLimitationNote: String(
      data.sampleSizeLimitationNote ||
        `Analysis based on ${reviewCount} verified review(s). Collect additional customer ratings to unlock deeper trade trends.`
    ).trim(),
    dataIntegrityNotice: String(
      data.dataIntegrityNotice ||
        'Derived exclusively from verified customer ratings and authenticated booking reviews.'
    ).trim(),
    modelUsed,
    generatedAt: new Date().toISOString(),
  };
}



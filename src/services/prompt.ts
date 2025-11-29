import type { ChatMessage, IdentifierRule } from '../types';
import { formatToWhatsAppExport } from '../utils/whatsappParser';

export function buildAnalysisPrompt(
  messages: ChatMessage[],
  rules: IdentifierRule[]
): string {
  const transcript = formatToWhatsAppExport(messages);

  const rulesSection = rules.length > 0
    ? `\n\nCHANNEL IDENTIFICATION RULES (STRICT PRIORITY):
${rules.map((rule) => `- If conversation contains "${rule.keyword}" -> Channel: ${rule.channel}`).join('\n')}

Apply these rules FIRST before using AI inference for channel attribution.`
    : '';

  return `You are analyzing a WhatsApp customer service conversation for a Tech/Repair shop.

CONVERSATION TRANSCRIPT:
${transcript}

${rulesSection}

Analyze this conversation and extract the following information in JSON format:

{
  "channel": "<Lead source: Facebook, Instagram, Google Ads, Organic, WhatsApp, Referral, or Other>",
  "equipmentType": "<High-level category: iPhone, Mac, iPad, Android, Other>",
  "equipmentLine": "<Specific model, e.g., iPhone 13 Pro, MacBook Air M2>",
  "repairType": "<Service category: Screen, Battery, Board, Software, Water Damage, Other>",
  "negotiationValue": <Numeric value discussed, or null if not mentioned>,
  "converted": <true if customer agreed to service/sale, false otherwise>,
  "attendantName": "<Name of the service agent from the conversation>",
  "qualityScore": <1-10 rating of agent performance>,
  "qualityReason": "<Brief explanation of quality score>",
  "summary": "<2-3 sentence summary of the conversation>"
}

INSTRUCTIONS:
- For channel: Check identification rules first, then infer from conversation context
- For negotiationValue: Extract only if explicitly mentioned (e.g., "250 reais", "R$ 150")
- For converted: Mark true only if customer confirmed service/purchase
- For qualityScore: Consider response time perception, professionalism, problem solving, clarity
- Be precise with equipment models when mentioned
- Use "Other" or null for missing/unclear information
- Respond ONLY with a valid JSON object. Do not include markdown fences, explanations, or trailing text.`;
}

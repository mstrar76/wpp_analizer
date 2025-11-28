import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AnalysisResult, ChatMessage, IdentifierRule, LeadChannel } from '../types';
import { formatToWhatsAppExport } from '../utils/whatsappParser';

let genAI: GoogleGenerativeAI | null = null;

/**
 * Initialize Gemini AI with API key
 */
export function initializeGemini(apiKey: string): void {
  genAI = new GoogleGenerativeAI(apiKey);
}

/**
 * Get API key from localStorage or environment
 */
export function getApiKey(): string | null {
  // Try localStorage first
  const storedKey = localStorage.getItem('gemini_api_key');
  if (storedKey) {
    return storedKey;
  }

  // Fallback to environment variable (for development)
  return import.meta.env.VITE_API_KEY || null;
}

/**
 * Save API key to localStorage
 */
export function saveApiKey(apiKey: string): void {
  localStorage.setItem('gemini_api_key', apiKey);
  initializeGemini(apiKey);
}

/**
 * Remove API key from localStorage
 */
export function clearApiKey(): void {
  localStorage.removeItem('gemini_api_key');
  genAI = null;
}

/**
 * Check if API key is configured
 */
export function isApiKeyConfigured(): boolean {
  return getApiKey() !== null;
}

/**
 * Build the analysis prompt with user rules
 */
function buildAnalysisPrompt(
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

Return ONLY the JSON object, no additional text.`;
}

/**
 * Parse Gemini response to AnalysisResult
 */
function parseGeminiResponse(responseText: string): AnalysisResult {
  try {
    // Remove markdown code blocks if present
    const cleaned = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Validate and normalize the response
    return {
      channel: (parsed.channel || 'Other') as LeadChannel,
      equipmentType: parsed.equipmentType || 'Unknown',
      equipmentLine: parsed.equipmentLine || 'Unknown',
      repairType: parsed.repairType || 'Other',
      negotiationValue: parsed.negotiationValue ? Number(parsed.negotiationValue) : undefined,
      converted: Boolean(parsed.converted),
      attendantName: parsed.attendantName || 'Unknown',
      qualityScore: Math.min(10, Math.max(1, Number(parsed.qualityScore) || 5)),
      qualityReason: parsed.qualityReason || 'No reason provided',
      summary: parsed.summary || 'No summary available',
    };
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    throw new Error('Failed to parse AI response');
  }
}

/**
 * Analyze a chat using Gemini AI
 */
export async function analyzeChat(
  messages: ChatMessage[],
  rules: IdentifierRule[]
): Promise<AnalysisResult> {
  if (!genAI) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }
    initializeGemini(apiKey);
  }

  if (!genAI) {
    throw new Error('Failed to initialize Gemini AI');
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.2, // Low temperature for consistent structured output
        maxOutputTokens: 1024,
      },
    });

    const prompt = buildAnalysisPrompt(messages, rules);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return parseGeminiResponse(text);
  } catch (error: any) {
    console.error('Error analyzing chat with Gemini:', error);
    
    // Handle specific API errors
    if (error.message?.includes('API_KEY')) {
      throw new Error('Invalid API key');
    }
    if (error.message?.includes('429')) {
      throw new Error('Rate limit exceeded. Please wait and try again.');
    }
    if (error.message?.includes('500') || error.message?.includes('503')) {
      throw new Error('Gemini service temporarily unavailable');
    }
    
    throw new Error(`Analysis failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Test API key validity
 */
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    const testAI = new GoogleGenerativeAI(apiKey);
    const model = testAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Simple test prompt
    const result = await model.generateContent('Say "OK"');
    const text = result.response.text();
    
    return text.includes('OK');
  } catch (error) {
    console.error('API key test failed:', error);
    return false;
  }
}

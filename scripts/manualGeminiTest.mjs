#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { GoogleGenerativeAI } from '@google/generative-ai';

function stripCodeFences(text) {
  return text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
}

function extractJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (char === '"' && !escaped) {
        inString = false;
      }
      escaped = char === '\\' && !escaped;
      if (char !== '\\') {
        escaped = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function buildPrompt(transcript) {
  return `You are analyzing a WhatsApp customer service conversation for a Tech/Repair shop.

CONVERSATION TRANSCRIPT:
${transcript}

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
- Respond ONLY with a valid JSON object. Do not include markdown fences, explanations, or trailing text.`;
}

async function main() {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.VITE_API_KEY;
  if (!apiKey) {
    console.error('Missing VITE_GEMINI_API_KEY or VITE_API_KEY in environment.');
    process.exit(1);
  }

  const relativePath = process.argv[2] || 'docs/chats/2023-02-09 19 51 52 - Cliente Felipe Ferreira Quadros/WhatsApp - 2025-05-09 20 18 58 - Cliente Felipe Ferreira Quadros.txt';
  const filePath = path.resolve(relativePath);
  if (!fs.existsSync(filePath)) {
    console.error(`Chat file not found: ${filePath}`);
    process.exit(1);
  }

  const transcript = fs.readFileSync(filePath, 'utf-8');
  const prompt = buildPrompt(transcript);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  });

  console.log('Sending request to Gemini with chat file:', filePath);
  const result = await model.generateContent(prompt);

  const response = result.response;
  console.log('\n--- Response metadata ---');
  console.log('Finish reason:', response.candidates?.[0]?.finishReason);
  console.log('Safety ratings:', JSON.stringify(response.candidates?.[0]?.safetyRatings, null, 2));
  console.log('Block reason:', response.promptFeedback?.blockReason);
  
  const raw = response.text();
  console.log('\n--- Raw Gemini output ---');
  console.log(raw || '(empty response)');

  const cleaned = stripCodeFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    console.log('\nJSON.parse succeeded. Keys:', Object.keys(parsed));
  } catch (err) {
    const extracted = extractJsonObject(cleaned);
    if (extracted) {
      try {
        const parsed = JSON.parse(extracted);
        console.log('\nJSON.parse succeeded after extraction. Keys:', Object.keys(parsed));
      } catch (innerErr) {
        console.error('\nFailed to parse extracted JSON block:', innerErr);
      }
    } else {
      console.error('\nNo JSON block found in response.');
    }
  }
}

main().catch((err) => {
  console.error('Unexpected error during manual Gemini test:', err);
  process.exit(1);
});

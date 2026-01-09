// Shared Gemini API helper with model fallback and improved error mapping
// NOTE: Requires EXPO_PUBLIC_GEMINI_API_KEY in .env

interface GeminiPartText { text: string }
interface GeminiPartInline { inline_data: { mime_type: string; data: string } }
interface GeminiContent { parts: (GeminiPartText | GeminiPartInline)[] }
interface GeminiRequest { contents: GeminiContent[] }

// Preferred static ordering for multimodal vision-capable models (latest first)
// We no longer include legacy 1.5/1.0 names since account lists only 2.x variants.
const STATIC_PREFERRED_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-pro',
  'gemini-pro-latest',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001'
];

export type GeminiErrorCode = 'API_KEY_INVALID' | 'MODEL_NOT_FOUND' | 'PERMISSION_DENIED' | 'UNKNOWN';

export interface GeminiResult {
  text: string;
  modelTried: string;
  attempts: number;
}

function buildRequest(prompt: string, mimeType: string, base64: string): GeminiRequest {
  return {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } }
        ]
      }
    ]
  };
}

function parseErrorStatus(statusCode: number, body: string): GeminiErrorCode {
  if (statusCode === 404) return 'MODEL_NOT_FOUND';
  if (statusCode === 403) return 'PERMISSION_DENIED';
  if (statusCode === 400 && body.includes('API key not valid')) return 'API_KEY_INVALID';
  return 'UNKNOWN';
}

export async function listModels(apiKey: string) {
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.models || [];
  } catch {
    return [];
  }
}

export async function extractTextFromMedia(params: {
  base64: string; // raw base64 (no data: prefix)
  mimeType: string; // 'image/jpeg' or 'application/pdf'
  promptOverride?: string;
}): Promise<GeminiResult> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    throw new Error('Gemini API key missing. Add EXPO_PUBLIC_GEMINI_API_KEY to .env then restart (npm start).');
  }

  const prompt = params.promptOverride || (params.mimeType === 'application/pdf'
    ? 'Extract all textual content from this document. Preserve line breaks. If no text found return "No text found".'
    : 'Extract every readable text fragment from this image. If no text found return "No text found". Return ONLY text.');

  // Fetch available models once for dynamic filtering (ignore failures silently)
  let dynamicModels: string[] = [];
  try {
    const available = await listModels(apiKey);
    dynamicModels = (available || [])
      .map((m: any) => (typeof m.name === 'string' ? m.name.replace(/^models\//, '') : ''))
      .filter((n: string) => n && /gemini/i.test(n))
      .filter((n: string) => !/embedding|aqa|imagen|robotics|nano|banana|learnlm/i.test(n))
      .filter((n: string) => /flash|pro/i.test(n)); // ensure multimodal candidate
  } catch {}

  // Build final ordered fallback sequence prioritizing static preferred order
  const fallbackSequence = [
    ...STATIC_PREFERRED_MODELS.filter(m => dynamicModels.includes(m)),
    // Add any remaining dynamic models not already included
    ...dynamicModels.filter(m => !STATIC_PREFERRED_MODELS.includes(m)),
    // As very last resort keep static list in case dynamic list was empty
    ...(!dynamicModels.length ? STATIC_PREFERRED_MODELS : [])
  ].filter((v, i, arr) => arr.indexOf(v) === i); // dedupe

  let lastError: Error | null = null;
  let attempt = 0;
  const notFoundModels: string[] = [];
  for (const model of fallbackSequence) {
    attempt += 1;
    const requestBody = buildRequest(prompt, params.mimeType, params.base64);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      if (!resp.ok) {
        const txt = await resp.text();
        const status = parseErrorStatus(resp.status, txt);
        // Fail fast for key issues
        if (status === 'API_KEY_INVALID') {
          throw new Error('Invalid Gemini API key. Regenerate a valid key at https://aistudio.google.com/app/apikey and update .env');
        }
        if (status === 'PERMISSION_DENIED') {
          throw new Error('Permission denied. Enable Generative Language API in Google Cloud for this key.');
        }
        // For model not found continue to next fallback
        if (status === 'MODEL_NOT_FOUND') {
          notFoundModels.push(model);
          lastError = new Error(`Model ${model} not found (404). Trying next fallback...`);
          continue;
        }
        throw new Error(`Gemini request failed ${resp.status}: ${txt.slice(0,160)}`);
      }
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'No text found';
      return { text, modelTried: model, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown Gemini error');
      // Continue to next model if recoverable
      continue;
    }
  }
  // All attempts exhausted
  if (notFoundModels.length === fallbackSequence.length) {
    // Attempt to list available models for clearer diagnostics
    try {
      const available = await listModels(apiKey);
      const availableNames = (available || []).map((m: any) => m.name).join(', ') || 'None returned';
      throw new Error(
        `None of the fallback models were found (404): ${notFoundModels.join(', ')}. ` +
        `Your API key may not have access to vision capable models yet or the Generative Language API is not fully enabled. ` +
        `Enable the API in Google Cloud Console and verify model availability. Available models reported: ${availableNames}`
      );
    } catch (e) {
      throw e instanceof Error ? e : new Error(
        `All fallback models missing: ${notFoundModels.join(', ')}. Enable Generative Language API & vision models for your project.`
      );
    }
  }
  throw lastError || new Error('Gemini extraction failed after all fallback models.');
}

// Convenience wrappers
export async function extractTextFromImageBase64(base64: string) {
  return extractTextFromMedia({ base64, mimeType: 'image/jpeg' });
}

export async function extractTextFromPdfBase64(base64: string) {
  return extractTextFromMedia({ base64, mimeType: 'application/pdf' });
}

// Shared Gemini API helper with model fallback and API key rotation
// NOTE: Supports EXPO_PUBLIC_GEMINI_API_KEYS="key1,key2" (preferred)
//       and EXPO_PUBLIC_GEMINI_API_KEY (fallback)

interface GeminiPartText { text: string }
interface GeminiPartInline { inline_data: { mime_type: string; data: string } }
interface GeminiContent { parts: (GeminiPartText | GeminiPartInline)[] }
interface GeminiRequest { contents: GeminiContent[] }

// Preferred static ordering for multimodal vision-capable models (latest first)
// We no longer include legacy 1.5/1.0 names since account lists only 2.x variants.
const STATIC_PREFERRED_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-pro',
  'gemini-pro-latest',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001'
];

export type GeminiErrorCode = 'API_KEY_INVALID' | 'MODEL_NOT_FOUND' | 'PERMISSION_DENIED' | 'UNKNOWN';
export type GeminiRetryableErrorCode = GeminiErrorCode | 'RATE_LIMIT';

export interface GeminiResult {
  text: string;
  modelTried: string;
  apiKeyUsed: string;
  attempts: number;
}

type ApiKeyState = {
  key: string;
  failures: number;
  cooldownUntil?: number;
};

const SINGLE_KEY = (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();
const MULTI_KEYS = (process.env.EXPO_PUBLIC_GEMINI_API_KEYS ?? '')
  .split(',')
  .map((k: string) => k.trim())
  .filter(Boolean);

const allConfiguredKeys = [...MULTI_KEYS, ...(SINGLE_KEY ? [SINGLE_KEY] : [])]
  .filter((key) => key !== 'YOUR_API_KEY_HERE')
  .filter((v, i, arr) => arr.indexOf(v) === i);

const apiKeys: ApiKeyState[] = allConfiguredKeys.map((key) => ({
  key,
  failures: 0
}));

const COOLDOWN_PERMISSION_DENIED_MS = 5 * 60_000;
const COOLDOWN_RATE_LIMIT_MS = 60_000;
const COOLDOWN_MODEL_NOT_FOUND_MS = 30_000;
const COOLDOWN_UNKNOWN_MS = 15_000;

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

function parseErrorStatus(statusCode: number, body: string): GeminiRetryableErrorCode {
  if (statusCode === 404) return 'MODEL_NOT_FOUND';
  if (statusCode === 403) return 'PERMISSION_DENIED';
  if (statusCode === 429) return 'RATE_LIMIT';
  if (statusCode === 400 && body.includes('API key not valid')) return 'API_KEY_INVALID';
  return 'UNKNOWN';
}

function getBestAvailableKey(excluded: Set<string>): ApiKeyState | null {
  const now = Date.now();
  const candidates = apiKeys.filter((k) => !excluded.has(k.key));
  if (!candidates.length) return null;

  const availableKeys = candidates
    .filter((k) => !k.cooldownUntil || k.cooldownUntil <= now)
    .sort((a, b) => a.failures - b.failures);
  if (availableKeys.length) return availableKeys[0];

  return null;
}

function getShortestRemainingCooldownMs(excluded: Set<string>): number | null {
  const now = Date.now();
  const remaining = apiKeys
    .filter((k) => !excluded.has(k.key))
    .map((k) => (k.cooldownUntil || 0) - now)
    .filter((ms) => ms > 0);
  if (!remaining.length) return null;
  return Math.min(...remaining);
}

function markFailure(keyObj: ApiKeyState, status: GeminiRetryableErrorCode) {
  keyObj.failures += 1;

  if (status === 'API_KEY_INVALID') {
    // Permanently exclude invalid keys from this app runtime.
    keyObj.cooldownUntil = Infinity;
    return;
  }
  if (status === 'PERMISSION_DENIED') {
    keyObj.cooldownUntil = Date.now() + COOLDOWN_PERMISSION_DENIED_MS;
    return;
  }
  if (status === 'RATE_LIMIT') {
    keyObj.cooldownUntil = Date.now() + COOLDOWN_RATE_LIMIT_MS;
    return;
  }
  if (status === 'MODEL_NOT_FOUND') {
    keyObj.cooldownUntil = Date.now() + COOLDOWN_MODEL_NOT_FOUND_MS;
    return;
  }

  keyObj.cooldownUntil = Date.now() + COOLDOWN_UNKNOWN_MS;
}

function markSuccess(keyObj: ApiKeyState) {
  keyObj.failures = 0;
  keyObj.cooldownUntil = undefined;
}

function maskApiKey(key: string) {
  if (!key) return '****';
  if (key.length <= 4) return '****';
  if (key.length <= 8) return `${key.slice(0, 2)}...${key.slice(-2)}`;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
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
  if (!apiKeys.length) {
    throw new Error('Gemini API key missing. Add EXPO_PUBLIC_GEMINI_API_KEYS or EXPO_PUBLIC_GEMINI_API_KEY to .env then restart (npm start).');
  }

  const prompt = params.promptOverride || (params.mimeType === 'application/pdf'
    ? 'Extract all textual content from this document. Preserve line breaks. If no text found return "No text found".'
    : 'Extract every readable text fragment from this image. If no text found return "No text found". Return ONLY text.');

  let lastError: Error | null = null;
  let attempt = 0;
  const triedKeys = new Set<string>();
  const allNotFoundModels: string[] = [];
  let hasNonModelNotFoundError = false;

  while (triedKeys.size < apiKeys.length) {
    const keyObj = getBestAvailableKey(triedKeys);
    if (!keyObj) {
      const shortestMs = getShortestRemainingCooldownMs(triedKeys);
      const waitSeconds = shortestMs ? Math.ceil(shortestMs / 1000) : null;
      lastError = new Error(
        waitSeconds
          ? `All configured Gemini API keys are in cooldown. Retry in about ${waitSeconds}s.`
          : 'All configured Gemini API keys are currently unavailable (cooldown or invalid). Please rotate keys or retry later.'
      );
      break;
    }
    triedKeys.add(keyObj.key);

    // Fetch available models per key for dynamic filtering (ignore failures silently)
    let dynamicModels: string[] = [];
    try {
      const available = await listModels(keyObj.key);
      dynamicModels = (available || [])
        .map((m: any) => (typeof m.name === 'string' ? m.name.replace(/^models\//, '') : ''))
        .filter((n: string) => n && /gemini/i.test(n))
        .filter((n: string) => !/embedding|aqa|imagen|robotics|nano|banana|learnlm/i.test(n))
        .filter((n: string) => /flash|pro/i.test(n));
    } catch {}

    // Build final ordered fallback sequence prioritizing static preferred order
    const fallbackSequence = [
      ...STATIC_PREFERRED_MODELS.filter((m) => dynamicModels.includes(m)),
      ...dynamicModels.filter((m) => !STATIC_PREFERRED_MODELS.includes(m)),
      ...(!dynamicModels.length ? STATIC_PREFERRED_MODELS : [])
    ].filter((v, i, arr) => arr.indexOf(v) === i);

    let onlyModelNotFoundErrors = true;

    for (const model of fallbackSequence) {
      attempt += 1;
      const requestBody = buildRequest(prompt, params.mimeType, params.base64);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyObj.key}`;
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!resp.ok) {
          const txt = await resp.text();
          const status = parseErrorStatus(resp.status, txt);

          if (status === 'MODEL_NOT_FOUND') {
            allNotFoundModels.push(model);
            lastError = new Error(`Model ${model} not found (404). Trying next fallback...`);
            continue;
          }

          onlyModelNotFoundErrors = false;
          hasNonModelNotFoundError = true;
          markFailure(keyObj, status);

          if (status === 'API_KEY_INVALID') {
            lastError = new Error('Invalid Gemini API key. Regenerate a valid key at https://aistudio.google.com/app/apikey and update .env');
          } else if (status === 'PERMISSION_DENIED') {
            lastError = new Error('Permission denied. Enable Generative Language API in Google Cloud for this key.');
          } else if (status === 'RATE_LIMIT') {
            lastError = new Error('Gemini API key is rate-limited (429). Rotating to next key.');
          } else {
            lastError = new Error(`Gemini request failed ${resp.status}: ${txt.slice(0, 160)}`);
          }
          break;
        }

        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'No text found';
        markSuccess(keyObj);
        return { text, modelTried: model, apiKeyUsed: maskApiKey(keyObj.key), attempts: attempt };
      } catch (err) {
        onlyModelNotFoundErrors = false;
        hasNonModelNotFoundError = true;
        markFailure(keyObj, 'UNKNOWN');
        lastError = err instanceof Error ? err : new Error('Unknown Gemini error');
        break;
      }
    }

    if (onlyModelNotFoundErrors) {
      markFailure(keyObj, 'MODEL_NOT_FOUND');
    }
  }

  // All attempts exhausted
  if (allNotFoundModels.length && !hasNonModelNotFoundError) {
    // Attempt to list available models for clearer diagnostics
    try {
      const diagnosticKey = getBestAvailableKey(new Set<string>())?.key || apiKeys[0]?.key;
      const available = diagnosticKey ? await listModels(diagnosticKey) : [];
      const availableNames = (available || []).map((m: any) => m.name).join(', ') || 'None returned';
      throw new Error(
        `None of the fallback models were found (404): ${allNotFoundModels.join(', ')}. ` +
        `Your API key may not have access to vision capable models yet or the Generative Language API is not fully enabled. ` +
        `Enable the API in Google Cloud Console and verify model availability. Available models reported: ${availableNames}`
      );
    } catch (e) {
      throw e instanceof Error ? e : new Error(
        `All fallback models missing: ${allNotFoundModels.join(', ')}. Enable Generative Language API & vision models for your project.`
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

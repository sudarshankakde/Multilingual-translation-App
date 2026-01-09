# Environment Variables Setup

## Gemini API Key & Model Configuration

### Option 1: Using .env File (Recommended for Development)

1. **Create or edit `.env` file** in the project root:
   ```bash
   EXPO_PUBLIC_GEMINI_API_KEY=YOUR_API_KEY_HERE
   ```

2. **Get your API key** from Google AI Studio:
   - Visit: https://makersuite.google.com/app/apikey
   - Click "Get API Key" or "Create API Key"
   - Copy the generated key

3. **Replace the placeholder** in `.env`:
   ```bash
   EXPO_PUBLIC_GEMINI_API_KEY=AIzaSyC_your_actual_key_here_xyz123
   ```

4. **Restart the development server**:
   ```bash
   npm start
   ```

### Option 2: Direct Code Edit (Not Recommended)

If you don't want to use environment variables, you can edit the API key directly in these files:

- `app/(tabs)/camera.tsx` - Line ~62
- `app/(tabs)/gallery.tsx` - Line ~25  
- `app/(tabs)/pdf.tsx` - Line ~31

Find this line:
```javascript
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'AIzaSyDSMw7T8REvNn6bUOqj0vpd-yGCKN7LgYo';
```

Replace with:
```javascript
const GEMINI_API_KEY = 'YOUR_NEW_API_KEY_HERE';
```

### Important Notes

1. **Security**: The `.env` file is now in `.gitignore` to prevent accidentally committing your API key to version control

2. **Expo Environment Variables**: Must be prefixed with `EXPO_PUBLIC_` to be accessible in the app

3. **Model Fallback**: The app dynamically tries multiple multimodal Gemini models. It first prefers latest 2.5 / flash / pro models and will iterate through available ones exposed to your key. If older 1.5 / 1.0 models are not provisioned, it will skip them automatically.

4. **Rate Limits**: Free tier limits:
   - 15 requests per minute
   - 1,500 requests per day
   - 1 million tokens per minute

### Testing

After setting up your API key:

1. Restart the Expo development server
2. Try the Camera, Gallery, or PDF features
3. Check console logs for "Sending to Gemini API..." messages

### Current Setup

✅ `.env` file created (requires your API key)
✅ All code files updated to use `process.env.EXPO_PUBLIC_GEMINI_API_KEY`
✅ `.gitignore` updated to exclude `.env` file
✅ Validation added to check for valid API key

### ⚠️ IMPORTANT: Get Your Own API Key

The previous API key was invalid. You MUST:

1. Visit: https://makersuite.google.com/app/apikey
2. Create a FREE Google AI Studio account (if needed)
3. Click "Create API Key"
4. Copy the key that starts with `AIzaSy...`
5. Paste it in `.env` file:
   ```
   EXPO_PUBLIC_GEMINI_API_KEY=AIzaSyC_paste_your_key_here
   ```
6. Restart: `npm start`

Without a valid API key, Camera/Gallery/PDF features will NOT work!

## Fallback Model Sequence (Dynamic)

The helper (`utils/gemini.ts`) builds a runtime fallback list based on the models your key reports via the list endpoint. Preferred order:

1. `gemini-2.5-flash`
2. `gemini-flash-latest`
3. `gemini-2.5-pro`
4. `gemini-pro-latest`
5. `gemini-2.0-flash`
6. `gemini-2.0-flash-001`
7. `gemini-2.0-flash-lite`
8. `gemini-2.0-flash-lite-001`

If the list API returns additional multimodal models (e.g. preview or image variants) they will be appended after the preferred static ones. Embedding-only or non‑vision models (e.g. `embedding-*`, `imagen-*`, `aqa`, `learnlm`) are filtered out.

## Troubleshooting 404 “Model Not Found”

If you see aggregated errors like:

> None of the fallback models were found (404)… Available models reported: models/gemini-2.5-flash, models/gemini-2.5-pro, …

Action steps:
- Confirm you are using REST endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key=YOUR_KEY`
- Remove `models/` prefix when specifying `{MODEL}`. Example: list returns `models/gemini-2.5-flash` → use `gemini-2.5-flash` in the path.
- Ensure the “Generative Language API” is enabled for your Google Cloud project linked to the key.
- Some enterprise / region accounts may need explicit enablement for vision or advanced models; verify in Cloud Console & AI Studio.
- Regenerate the key if you recently rotated permissions (keys can cache capability for a short time).
- Check network: corporate proxies stripping query params can yield false 404.

## Common Error Guidance

| Error Code | Meaning | Fix |
|------------|---------|-----|
| API_KEY_INVALID | Key malformed or revoked | Regenerate at AI Studio & update `.env` |
| PERMISSION_DENIED | Feature/model not enabled | Enable API + required scopes in Cloud Console |
| MODEL_NOT_FOUND | Model name not provisioned | Use available model names from list endpoint (remove `models/` prefix) |
| UNKNOWN | Generic failure | Inspect logged response snippet; retry or reduce payload size |

## Verifying Available Models

The helper calls the list endpoint automatically on failure. You can manually check:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=$EXPO_PUBLIC_GEMINI_API_KEY" | grep -i gemini
```

Strip the `models/` prefix to use any returned name in the request path.

## PDF & Image Extraction Notes

All selected fallback models are multimodal. If extraction returns `No text found` for image‑heavy PDFs, the document likely embeds scanned pages without OCR layers; consider preprocessing with an OCR service if consistent.

## Restart After Changes

Any change to `.env` requires a dev server restart:

```bash
npx expo start --clear
```

The `--clear` flag rebuilds Metro caches ensuring new env vars propagate.

## Minimum Required Variables

```bash
EXPO_PUBLIC_GEMINI_API_KEY=AIzaSyC_actual_key
```

No other Gemini env vars are required presently; model selection is dynamic.

## Security Reminder

Never commit your `.env` file. Confirm `.env` appears in `.gitignore` before pushing.

## Next Steps After Setup

1. Open Camera / Gallery and test extraction on a simple printed text image.
2. Upload a small (≤2MB) PDF containing selectable text.
3. Observe console logs for lines: `Gemini used model: gemini-2.5-flash attempts:1`.
4. If multiple attempts occur, earlier models lacked access. Review Troubleshooting section.

---
Updated: Adaptive fallback for Gemini 2.x models.

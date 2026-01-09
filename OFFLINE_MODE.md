# 📴 Offline Mode Guide

## Overview

Your translation app now supports **smart offline functionality** through an intelligent caching system. This means you can access previously translated content without an internet connection.

## ✅ What Works Offline

- ✅ **Cached Translations**: Any text you've translated before
- ✅ **Translation History**: View all past translations
- ✅ **Text-to-Speech**: Speak cached translations
- ✅ **Language Selection**: Change language preferences
- ✅ **Settings**: Adjust all app settings

## ❌ What Requires Internet

- ❌ **New Translations**: Translating text you haven't seen before
- ❌ **Auto-Detect Language**: Automatic language detection
- ❌ **Camera Translation**: Real-time OCR and translation
- ❌ **PDF/Image Translation**: New document processing

## 🚀 How to Use Offline Mode

### Automatic Offline Detection

The app automatically detects when you lose internet connection:

1. **No Configuration Needed**: Just lose internet connection
2. **Visual Indicator**: An "Offline Mode" badge appears on the translate screen
3. **Automatic Fallback**: The app will use cached translations automatically
4. **Network Status**: Check Settings → Network & Offline Mode to see connection status

### Manual Offline Mode

Force the app to work offline even when connected:

1. Open **Settings**
2. Navigate to **Network & Offline Mode** section
3. Toggle **Offline Mode** ON
4. The app will now only use cached translations

**Use Cases:**
- Save mobile data
- Avoid slow API calls
- Test offline functionality
- Ensure faster responses with cache-first approach

## 💾 Translation Cache System

### How Caching Works

```
User translates "Hello" from English to Spanish
    ↓
App sends request to translation API
    ↓
Receives "Hola" as result
    ↓
Translation is displayed to user
    ↓
ALSO: Translation is saved to local cache
    ↓
Next time "Hello" (en→es) is requested:
Cache returns "Hola" instantly (offline or online)
```

### Cache Specifications

- **Storage Location**: AsyncStorage (device local storage)
- **Cache Size**: Up to 1,000 most recent translations
- **Cache Key Format**: `{sourceLanguage}:{targetLanguage}:{normalizedText}`
- **Persistence**: Cache survives app restarts
- **Smart Matching**: Case-insensitive text matching

### Viewing Cache Statistics

1. Go to **Settings**
2. Look for **Network & Offline Mode** section
3. See **Cached Translations** count

Example: "127 translations saved for offline use"

## 🎯 Building Your Offline Library

### Best Practices

1. **Translate Common Phrases Online**
   - Greetings: Hello, Good morning, Thank you
   - Questions: Where is...? How much...? Can you...?
   - Essentials: Yes, No, Please, Help

2. **Use Consistent Language Pairs**
   - The cache is specific to language combinations
   - English→Spanish cache won't help with English→French

3. **Pre-translate Before Travel**
   - Spend 10 minutes translating common phrases
   - Build a library of 50-100 essential translations
   - Test offline mode before losing connection

4. **Leverage Translation History**
   - Review your most-used translations in History tab
   - These are all cached and available offline

## 🔧 Technical Details

### Cache Storage Format

```json
{
  "key": "en:es:hello",
  "originalText": "Hello",
  "translatedText": "Hola",
  "sourceLanguage": "en",
  "targetLanguage": "es",
  "timestamp": 1700000000000
}
```

### Network Detection

The app uses `@react-native-community/netinfo` to monitor:
- WiFi connection status
- Mobile data connection
- Network reachability
- Connection type and quality

### Cache Lookup Logic

```typescript
1. User requests translation
2. Generate cache key: lowercase(sourceLanguage:targetLanguage:text)
3. Check if key exists in cache
4. If OFFLINE and CACHED → Return cached result
5. If OFFLINE and NOT CACHED → Show error
6. If ONLINE and CACHED → Return cached (fast response)
7. If ONLINE and NOT CACHED → Fetch from API, cache result
```

## 📊 Performance Benefits

### With Offline Caching

- **Response Time**: < 10ms (instant)
- **Data Usage**: 0 KB (no network call)
- **Battery Impact**: Minimal (no network radio)
- **Reliability**: 100% (no network failures)

### Without Caching

- **Response Time**: 500-2000ms (varies)
- **Data Usage**: ~2-5 KB per translation
- **Battery Impact**: Higher (network radio active)
- **Reliability**: Depends on network quality

## 🐛 Troubleshooting

### "No cached translation available"

**Problem**: Trying to translate new text while offline

**Solutions:**
1. Connect to internet
2. Use a phrase you've translated before
3. Check your cache count in Settings
4. Pre-translate common phrases while online

### Offline badge not appearing when disconnected

**Problem**: Network detection not working

**Solutions:**
1. Toggle Airplane mode on/off
2. Check WiFi settings
3. Restart the app
4. Manually enable Offline Mode in Settings

### Cache not persisting between sessions

**Problem**: Translations not available after app restart

**Solutions:**
1. Ensure app has storage permissions
2. Check available device storage
3. Don't clear app data/cache from system settings
4. Re-translate frequently used phrases

### Wrong translation from cache

**Problem**: Cached translation is incorrect

**Solutions:**
1. Connect to internet
2. Translate with slightly different wording
3. The online API will provide new translation
4. New (correct) translation will update cache

## 💡 Pro Tips

1. **Build a Phrasebook**: Use the app online to translate a list of essential phrases, then you have them forever offline

2. **Language Learning**: Perfect for language students - translate vocabulary lists online, then practice offline

3. **Travel Preparation**: Before international trips, translate common scenarios while connected to WiFi

4. **Data Savings**: Enable Manual Offline Mode when on limited mobile data to use cache-first

5. **Speed Boost**: Even when online, cached translations return instantly for better UX

## 🔐 Privacy & Security

- ✅ All cache data stored locally on your device
- ✅ No cloud sync (your translations stay private)
- ✅ Cache cleared when you clear app data
- ✅ No personal information in cached data
- ✅ Translation history separate from cache

## 🚀 Future Enhancements

Planned improvements to offline functionality:

- [ ] **On-Device ML Translation**: True offline translation for new phrases
- [ ] **Smart Cache Prioritization**: Keep most-used translations
- [ ] **Cache Export/Import**: Share cache between devices
- [ ] **Language Pack Downloads**: Download offline translation models
- [ ] **Predictive Caching**: Pre-cache related phrases
- [ ] **Fuzzy Matching**: Find similar cached translations

## 📚 Related Features

- **Translation History**: All past translations (Settings → Data)
- **Auto-speak**: TTS works offline with cached text
- **Language Pairs**: Each pair maintains separate cache

---

**Need Help?** Check the main [README.md](./README.md) or create an issue on GitHub.

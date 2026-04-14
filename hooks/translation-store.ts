import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Platform, Share } from 'react-native';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import NetInfo from '@react-native-community/netinfo';
import { Translation, TTSVoice, TTSSettings } from '@/types/translation';

const STORAGE_KEY = 'translation_history';
const SETTINGS_KEY = 'translation_settings';
const TRANSLATION_CACHE_KEY = 'translation_cache';

interface TranslationSettings {
  sourceLanguage: string;
  targetLanguage: string;
  autoSpeak: boolean;
  speechRate: number;
  ttsSettings: TTSSettings;
  offlineMode: boolean; // User preference for offline mode
}

interface TranslationCacheEntry {
  key: string; // hash of text + source + target
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
}

interface LanguageMismatchCheckResult {
  shouldPrompt: boolean;
  detectedLanguage: string | null;
}

const isRecommendedVoice = (voice: TTSVoice) => {
  const quality = voice.quality?.toLowerCase?.() ?? '';
  const name = voice.name.toLowerCase();

  if (quality.includes('premium') || quality.includes('enhanced') || quality.includes('high')) {
    return true;
  }

  const humanLikeHints = [
    'neural',
    'natural',
    'premium',
    'enhanced',
    'studio',
    'wave',
    'siri',
    'google',
    'microsoft',
    'amazon',
    'voice',
  ];

  return humanLikeHints.some(hint => name.includes(hint));
};

const normalizeLanguageCode = (code: string) => code.trim().toLowerCase();

const getSpeechLanguageTag = (language?: string) => {
  if (!language) {
    return undefined;
  }

  const normalized = normalizeLanguageCode(language);
  const localeMap: Record<string, string> = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-PT',
    'pt-br': 'pt-BR',
    ru: 'ru-RU',
    ja: 'ja-JP',
    ko: 'ko-KR',
    zh: 'zh-CN',
    ar: 'ar-SA',
    hi: 'hi-IN',
    th: 'th-TH',
    vi: 'vi-VN',
    tr: 'tr-TR',
    pl: 'pl-PL',
    nl: 'nl-NL',
    sv: 'sv-SE',
    da: 'da-DK',
    no: 'nb-NO',
    fi: 'fi-FI',
    he: 'he-IL',
  };

  return localeMap[normalized] || language;
};

const voiceMatchesLanguage = (voiceLanguage: string, language?: string) => {
  if (!language) {
    return true;
  }

  const requested = normalizeLanguageCode(language).split('-')[0];
  const voiceRoot = normalizeLanguageCode(voiceLanguage).split('-')[0];
  return requested === voiceRoot;
};

const defaultSettings: TranslationSettings = {
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  autoSpeak: false,
  speechRate: 1.0,
  ttsSettings: {
    voice: '',
    pitch: 1.0,
    rate: 1.0,
    volume: 1.0,
  },
  offlineMode: false,
};

export const [TranslationProvider, useTranslation] = createContextHook(() => {
  const [history, setHistory] = useState<Translation[]>([]);
  const [settings, setSettings] = useState<TranslationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<TTSVoice[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [translationCache, setTranslationCache] = useState<Map<string, TranslationCacheEntry>>(new Map());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeakingText, setCurrentSpeakingText] = useState<string>('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const hasLoadedVoicesRef = useRef(false);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedHistory = JSON.parse(stored);
        setHistory(parsedHistory);
      }
    } catch (error) {
      console.error('Failed to load translation history:', error);
    }
  };

  const loadTranslationCache = async () => {
    try {
      const stored = await AsyncStorage.getItem(TRANSLATION_CACHE_KEY);
      if (stored) {
        const cacheArray: TranslationCacheEntry[] = JSON.parse(stored);
        const cacheMap = new Map(cacheArray.map(entry => [entry.key, entry]));
        setTranslationCache(cacheMap);
      }
    } catch (error) {
      console.error('Failed to load translation cache:', error);
    }
  };

  const saveTranslationCache = useCallback(async (cache: Map<string, TranslationCacheEntry>) => {
    try {
      const cacheArray = Array.from(cache.values());
      // Keep only the most recent 1000 translations
      const limitedCache = cacheArray.slice(0, 1000);
      await AsyncStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(limitedCache));
    } catch (error) {
      console.error('Failed to save translation cache:', error);
    }
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        const mergedSettings = { ...defaultSettings, ...parsedSettings };
        if (mergedSettings.targetLanguage === 'auto') {
          mergedSettings.targetLanguage = defaultSettings.targetLanguage;
        }
        if (typeof mergedSettings.autoSpeak !== 'boolean') {
          mergedSettings.autoSpeak = false;
        }
        if (typeof mergedSettings.speechRate !== 'number') {
          mergedSettings.speechRate = defaultSettings.speechRate;
        }
        setSettings(mergedSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveHistory = async (newHistory: Translation[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Failed to save translation history:', error);
    }
  };

  const saveSettings = useCallback(async (newSettings: TranslationSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, []);

  const addTranslation = useCallback((translation: Omit<Translation, 'id' | 'timestamp'>) => {
    const newTranslation: Translation = {
      ...translation,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };

    const newHistory = [newTranslation, ...history.slice(0, 99)]; // Keep only last 100
    setHistory(newHistory);
    saveHistory(newHistory);
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<TranslationSettings>) => {
    setSettings(currentSettings => {
      const updated = { ...currentSettings, ...newSettings };
      void saveSettings(updated);
      return updated;
    });
  }, [saveSettings]);

  const loadAvailableVoices = useCallback(async () => {
    if (hasLoadedVoicesRef.current || Platform.OS === 'web') {
      return;
    }

    hasLoadedVoicesRef.current = true;
    setIsLoadingVoices(true);

    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const formattedVoices: TTSVoice[] = voices.map(voice => ({
        identifier: voice.identifier,
        name: voice.name,
        language: voice.language,
        quality: voice.quality,
      }));
      const recommendedVoices = formattedVoices.filter(isRecommendedVoice);
      setAvailableVoices(recommendedVoices.length > 0 ? recommendedVoices : formattedVoices);

      setSettings(currentSettings => {
        const candidateVoices = recommendedVoices.length > 0 ? recommendedVoices : formattedVoices;

        if (currentSettings.ttsSettings.voice || candidateVoices.length === 0) {
          return currentSettings;
        }

        const defaultVoice =
          candidateVoices.find(v => v.language.toLowerCase().startsWith('en')) ||
          candidateVoices.find(v => v.language.toLowerCase().startsWith('en-')) ||
          candidateVoices[0];
        const updatedSettings = {
          ...currentSettings,
          ttsSettings: {
            ...currentSettings.ttsSettings,
            voice: defaultVoice.identifier,
          },
        };

        void saveSettings(updatedSettings);
        return updatedSettings;
      });
    } catch {
      setAvailableVoices([]);
      console.warn('TTS voices are unavailable on this device. Continuing without voice preloading.');
    } finally {
      setIsLoadingVoices(false);
    }
  }, [saveSettings]);

  useEffect(() => {
    loadHistory();
    loadSettings();
    loadTranslationCache();
    
    // Monitor network connectivity
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
      // console.log(`📡 Network status: ${state.isConnected ? 'Online' : 'Offline'}`);
    });

    return () => {
      unsubscribe();
    };
  }, [loadAvailableVoices]);

  const speakText = useCallback(async (text: string, language?: string) => {
    if (Platform.OS === 'web') {
      console.log('TTS not available on web');
      return;
    }

    try {
      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const clampedRate = Math.min(Math.max(settings.speechRate || settings.ttsSettings.rate || 1, 0.5), 2.0);
      const clampedVolume = Math.min(Math.max(settings.ttsSettings.volume ?? 1, 0.0), 1.0);
      
      const options: Speech.SpeechOptions = {
        rate: clampedRate,
        pitch: settings.ttsSettings.pitch,
        volume: clampedVolume,
        onStart: () => {
          setIsSpeaking(true);
          setCurrentSpeakingText(text);
        },
        onDone: () => {
          setIsSpeaking(false);
          setCurrentSpeakingText('');
        },
        onStopped: () => {
          setIsSpeaking(false);
          setCurrentSpeakingText('');
        },
        onError: () => {
          setIsSpeaking(false);
          setCurrentSpeakingText('');
        },
      };

      const speechLanguageTag = getSpeechLanguageTag(language);
      const selectedVoice = availableVoices.find(voice => voice.identifier === settings.ttsSettings.voice);

      if (selectedVoice && voiceMatchesLanguage(selectedVoice.language, language)) {
        options.voice = settings.ttsSettings.voice;
      } else if (speechLanguageTag) {
        options.language = speechLanguageTag;
      }

      await Speech.speak(text, options);
    } catch {
      console.error('TTS failed');
      setIsSpeaking(false);
      setCurrentSpeakingText('');
    }
  }, [availableVoices, settings.ttsSettings, settings.speechRate]);

  const pauseSpeech = useCallback(async () => {
    if (Platform.OS === 'web' || Platform.OS === 'android') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Speech.pause();
      setIsSpeaking(false);
    } catch (error) {
      console.error('Pause TTS failed:', error);
    }
  }, []);

  const resumeSpeech = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Speech.resume();
      setIsSpeaking(true);
    } catch (error) {
      console.error('Resume TTS failed:', error);
    }
  }, []);

  const stopSpeech = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Speech.stop();
      setIsSpeaking(false);
      setCurrentSpeakingText('');
    } catch (error) {
      console.error('Stop TTS failed:', error);
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Clipboard.setStringAsync(text);
      console.log('✅ Copied to clipboard');
      return true;
    } catch (error) {
      console.error('Copy failed:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
  }, []);

  const shareTranslation = useCallback(async (originalText: string, translatedText: string, sourceLang: string, targetLang: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const message = `${originalText}\n\n→ ${translatedText}\n\n(${sourceLang} → ${targetLang})`;
      
      const result = await Share.share({
        message,
        title: 'Translation',
      });

      if (result.action === Share.sharedAction) {
        console.log('✅ Translation shared');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Share failed:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
  }, []);

  const splitTextForTranslation = (text: string, maxChunkLength: number = 1800) => {
    const trimmedText = text.trim();
    if (trimmedText.length <= maxChunkLength) {
      return [trimmedText];
    }

    const chunks: string[] = [];
    let cursor = 0;

    while (cursor < trimmedText.length) {
      let end = Math.min(cursor + maxChunkLength, trimmedText.length);

      if (end < trimmedText.length) {
        const breakCandidates = [
          trimmedText.lastIndexOf('\n\n', end),
          trimmedText.lastIndexOf('\n', end),
          trimmedText.lastIndexOf('. ', end),
          trimmedText.lastIndexOf('! ', end),
          trimmedText.lastIndexOf('? ', end),
          trimmedText.lastIndexOf(', ', end),
          trimmedText.lastIndexOf(' ', end),
        ];

        const breakPoint = breakCandidates.find(position => position > cursor + 200);
        if (breakPoint && breakPoint > cursor) {
          end = breakPoint;
        }
      }

      const chunk = trimmedText.slice(cursor, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }

      cursor = end;
      while (cursor < trimmedText.length && /\s/.test(trimmedText[cursor])) {
        cursor += 1;
      }
    }

    return chunks.length ? chunks : [trimmedText];
  };

  const translateSingleChunk = useCallback(async (text: string, sourceLanguage: string, targetLanguage: string, timeoutMs: number = 30000): Promise<string> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a professional translator. Translate the given text from ${sourceLanguage === 'auto' ? 'the detected language' : sourceLanguage} to ${targetLanguage}. Only return the translated text, nothing else. If the source language is 'auto', detect the language automatically.`
            },
            {
              role: 'user',
              content: text
            }
          ]
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(details ? `HTTP error! status: ${response.status} - ${details.slice(0, 160)}` : `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.completion || text;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Translation request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
      }
      throw error;
    }
  }, []);

  const normalizeLanguageCode = (code: string): string => {
    return code.trim().toLowerCase().split('-')[0];
  };

  const detectLanguageCode = useCallback(async (text: string, timeoutMs: number = 15000): Promise<string | null> => {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'Detect the language of the provided text. Return only the ISO 639-1 language code in lowercase (example: en, hi, fr). No extra words or punctuation.',
            },
            {
              role: 'user',
              content: normalizedText,
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const detected = String(data?.completion ?? '').trim().toLowerCase();
      if (!detected) {
        return null;
      }

      const match = detected.match(/[a-z]{2,3}(?:-[a-z]{2})?/);
      return match ? match[0] : null;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }, []);

  const shouldPromptTargetLanguageChange = useCallback(async (
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<LanguageMismatchCheckResult> => {
    if (sourceLanguage !== 'auto' || targetLanguage === 'auto') {
      return { shouldPrompt: false, detectedLanguage: null };
    }

    const detectedLanguage = await detectLanguageCode(text);
    if (!detectedLanguage) {
      return { shouldPrompt: false, detectedLanguage: null };
    }

    const isSameLanguage = normalizeLanguageCode(detectedLanguage) === normalizeLanguageCode(targetLanguage);
    return {
      shouldPrompt: isSameLanguage,
      detectedLanguage,
    };
  }, [detectLanguageCode]);

  // Generate cache key for a translation
  const getCacheKey = (text: string, sourceLang: string, targetLang: string): string => {
    return `${sourceLang}:${targetLang}:${text.toLowerCase().trim()}`;
  };

  // Get translation from cache
  const getCachedTranslation = useCallback((text: string, sourceLang: string, targetLang: string): string | null => {
    const key = getCacheKey(text, sourceLang, targetLang);
    const cached = translationCache.get(key);
    if (cached) {
      console.log('✅ Using cached translation');
      return cached.translatedText;
    }
    return null;
  }, [translationCache]);

  // Add translation to cache
  const addToCache = useCallback((text: string, translatedText: string, sourceLang: string, targetLang: string) => {
    const key = getCacheKey(text, sourceLang, targetLang);
    const entry: TranslationCacheEntry = {
      key,
      originalText: text,
      translatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      timestamp: Date.now(),
    };
    
    const newCache = new Map(translationCache);
    newCache.set(key, entry);
    setTranslationCache(newCache);
    saveTranslationCache(newCache);
  }, [translationCache, saveTranslationCache]);

  const translateText = useCallback(async (text: string, sourceLanguage: string, targetLanguage: string): Promise<string> => {
    setIsLoading(true);
    try {
      // First, check cache
      const cached = getCachedTranslation(text, sourceLanguage, targetLanguage);
      
      // If offline mode is enabled or no internet, use cache only
      if (settings.offlineMode || !isOnline) {
        if (cached) {
          setIsLoading(false);
          return cached;
        } else {
          setIsLoading(false);
          throw new Error('No cached translation available. Please connect to the internet for new translations.');
        }
      }

      // If we have cached result and we're online, use it while attempting to refresh in background
      if (cached && isOnline) {
        // Return cached immediately for better UX
        setIsLoading(false);
        return cached;
      }

      const normalizedText = text.trim();
      const chunkThreshold = 1800;
      const chunks = splitTextForTranslation(normalizedText, chunkThreshold);

      if (chunks.length > 1) {
        const translatedChunks: string[] = [];

        for (const chunk of chunks) {
          const translatedChunk = await translateSingleChunk(chunk, sourceLanguage, targetLanguage, 45000);
          translatedChunks.push(translatedChunk);
        }

        const translatedText = translatedChunks.join('\n\n');
        addToCache(text, translatedText, sourceLanguage, targetLanguage);

        if (settings.autoSpeak && translatedText !== text) {
          await speakText(translatedText, targetLanguage);
        }

        return translatedText;
      }

      // Try online translation
      const translatedText = await translateSingleChunk(normalizedText, sourceLanguage, targetLanguage, 45000);
      
      // Cache the translation for offline use
      addToCache(text, translatedText, sourceLanguage, targetLanguage);
      
      if (settings.autoSpeak && translatedText !== text) {
        await speakText(translatedText, targetLanguage);
      }
      
      return translatedText;
    } catch (error) {
      console.error('Translation failed:', error);
      
      // If online translation fails, try cache as fallback
      const cached = getCachedTranslation(text, sourceLanguage, targetLanguage);
      if (cached) {
        console.log('⚠️ Online translation failed, using cached version');
        return cached;
      }
      
      if (error instanceof Error && /timed out/i.test(error.message)) {
        throw new Error(`${error.message} Try again with a smaller input or after a moment.`);
      }

      throw new Error(error instanceof Error ? error.message : 'Translation failed. Please check your internet connection or try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [settings.autoSpeak, settings.offlineMode, isOnline, speakText, translateSingleChunk, addToCache, getCachedTranslation]);

  // Compute effective offline state (user preference OR no network)
  const isOffline = useMemo(() => settings.offlineMode || !isOnline, [settings.offlineMode, isOnline]);

  return useMemo(() => ({
    history,
    settings,
    isLoading,
    availableVoices,
    isOnline,
    isOffline,
    translationCache: translationCache.size,
    isLoadingVoices,
    isSpeaking,
    currentSpeakingText,
    loadAvailableVoices,
    addTranslation,
    clearHistory,
    updateSettings,
    translateText,
    speakText,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
    copyToClipboard,
    shareTranslation,
    shouldPromptTargetLanguageChange,
  }), [history, settings, isLoading, availableVoices, isLoadingVoices, isOnline, isOffline, translationCache, isSpeaking, currentSpeakingText, addTranslation, clearHistory, updateSettings, translateText, speakText, pauseSpeech, resumeSpeech, stopSpeech, copyToClipboard, shareTranslation, shouldPromptTargetLanguageChange, loadAvailableVoices]);
});
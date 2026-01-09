import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo } from 'react';
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

  const saveTranslationCache = async (cache: Map<string, TranslationCacheEntry>) => {
    try {
      const cacheArray = Array.from(cache.values());
      // Keep only the most recent 1000 translations
      const limitedCache = cacheArray.slice(0, 1000);
      await AsyncStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(limitedCache));
    } catch (error) {
      console.error('Failed to save translation cache:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsedSettings });
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

  const saveSettings = async (newSettings: TranslationSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

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
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSettings(updated);
  }, [settings]);

  const loadAvailableVoices = useCallback(async () => {
    if (Platform.OS !== 'web') {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        const formattedVoices: TTSVoice[] = voices.map(voice => ({
          identifier: voice.identifier,
          name: voice.name,
          language: voice.language,
          quality: voice.quality,
        }));
        setAvailableVoices(formattedVoices);
        
        if (!settings.ttsSettings.voice && formattedVoices.length > 0) {
          const defaultVoice = formattedVoices.find(v => v.language.startsWith('en')) || formattedVoices[0];
          updateSettings({
            ttsSettings: {
              ...settings.ttsSettings,
              voice: defaultVoice.identifier,
            }
          });
        }
      } catch (error) {
        console.error('Failed to load voices:', error);
      }
    }
  }, [settings.ttsSettings, updateSettings]);

  useEffect(() => {
    loadHistory();
    loadSettings();
    loadAvailableVoices();
    loadTranslationCache();
    
    // Monitor network connectivity
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
      console.log(`📡 Network status: ${state.isConnected ? 'Online' : 'Offline'}`);
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
      
      const options: Speech.SpeechOptions = {
        rate: settings.ttsSettings.rate,
        pitch: settings.ttsSettings.pitch,
        volume: settings.ttsSettings.volume,
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

      if (settings.ttsSettings.voice) {
        options.voice = settings.ttsSettings.voice;
      } else if (language) {
        options.language = language;
      }

      await Speech.speak(text, options);
    } catch (error) {
      console.error('TTS failed:', error);
      setIsSpeaking(false);
      setCurrentSpeakingText('');
    }
  }, [settings.ttsSettings]);

  const pauseSpeech = useCallback(async () => {
    if (Platform.OS === 'web') return;
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

  // Generate cache key for a translation
  const getCacheKey = (text: string, sourceLang: string, targetLang: string): string => {
    return `${sourceLang}:${targetLang}:${text.toLowerCase().trim()}`;
  };

  // Get translation from cache
  const getCachedTranslation = (text: string, sourceLang: string, targetLang: string): string | null => {
    const key = getCacheKey(text, sourceLang, targetLang);
    const cached = translationCache.get(key);
    if (cached) {
      console.log('✅ Using cached translation');
      return cached.translatedText;
    }
    return null;
  };

  // Add translation to cache
  const addToCache = (text: string, translatedText: string, sourceLang: string, targetLang: string) => {
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
  };

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

      // Try online translation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.completion || text;
      
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
      
      throw new Error('Translation failed. Please check your internet connection or try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [settings.autoSpeak, settings.offlineMode, isOnline, translationCache, speakText]);

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
    isSpeaking,
    currentSpeakingText,
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
  }), [history, settings, isLoading, availableVoices, isOnline, isOffline, translationCache, isSpeaking, currentSpeakingText, addTranslation, clearHistory, updateSettings, translateText, speakText, pauseSpeech, resumeSpeech, stopSpeech, copyToClipboard, shareTranslation]);
});
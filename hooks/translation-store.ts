import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { Translation, TTSVoice, TTSSettings } from '@/types/translation';

const STORAGE_KEY = 'translation_history';
const SETTINGS_KEY = 'translation_settings';

interface TranslationSettings {
  sourceLanguage: string;
  targetLanguage: string;
  autoSpeak: boolean;
  speechRate: number;
  ttsSettings: TTSSettings;
  screenTranslationEnabled: boolean;
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
  screenTranslationEnabled: false,
};

export const [TranslationProvider, useTranslation] = createContextHook(() => {
  const [history, setHistory] = useState<Translation[]>([]);
  const [settings, setSettings] = useState<TranslationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<TTSVoice[]>([]);
  const [isScreenTranslationActive, setIsScreenTranslationActive] = useState(false);

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
  }, [loadAvailableVoices]);

  const speakText = useCallback(async (text: string, language?: string) => {
    if (Platform.OS === 'web') {
      console.log('TTS not available on web');
      return;
    }

    try {
      const options: Speech.SpeechOptions = {
        rate: settings.ttsSettings.rate,
        pitch: settings.ttsSettings.pitch,
        volume: settings.ttsSettings.volume,
      };

      if (settings.ttsSettings.voice) {
        options.voice = settings.ttsSettings.voice;
      } else if (language) {
        options.language = language;
      }

      await Speech.speak(text, options);
    } catch (error) {
      console.error('TTS failed:', error);
    }
  }, [settings.ttsSettings]);

  const toggleScreenTranslation = useCallback(() => {
    setIsScreenTranslationActive(prev => !prev);
  }, []);

  const translateText = useCallback(async (text: string, sourceLanguage: string, targetLanguage: string): Promise<string> => {
    setIsLoading(true);
    try {
      // Check if we have internet connectivity
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
      
      if (settings.autoSpeak && translatedText !== text) {
        await speakText(translatedText, targetLanguage);
      }
      
      return translatedText;
    } catch (error) {
      console.error('Translation failed:', error);
      throw new Error('Translation failed. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  }, [settings.autoSpeak, speakText]);

  return useMemo(() => ({
    history,
    settings,
    isLoading,
    availableVoices,
    isScreenTranslationActive,
    addTranslation,
    clearHistory,
    updateSettings,
    translateText,
    speakText,
    toggleScreenTranslation,
  }), [history, settings, isLoading, availableVoices, isScreenTranslationActive, addTranslation, clearHistory, updateSettings, translateText, speakText, toggleScreenTranslation]);
});
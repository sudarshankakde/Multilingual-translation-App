import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRightLeft, Trash2, Wifi, WifiOff, Copy, Share2, Volume2, VolumeX, Check, Play, Pause } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import LanguageSelector from '@/components/LanguageSelector';
import TranslationCard from '@/components/TranslationCard';
import { useTranslation } from '@/hooks/translation-store';
import OfflineScreen from '@/components/OfflineScreen';

export default function TranslateScreen() {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [copied, setCopied] = useState<'input' | 'output' | null>(null);
  const buttonScale = useState(new Animated.Value(1))[0];
  const resultOpacity = useState(new Animated.Value(0))[0];
  const { settings, updateSettings, translateText, addTranslation, isLoading, isOnline, copyToClipboard, shareTranslation, speakText, stopSpeech, isSpeaking, currentSpeakingText, isOffline } = useTranslation();
  const insets = useSafeAreaInsets();

  if (isOffline) {
    return <OfflineScreen message="Text translation requires an internet connection to translate text between languages." />;
  }

  const animateButton = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      console.log('Error: Please enter text to translate');
      return;
    }

    if (settings.targetLanguage === 'auto') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      console.log('Error: Please select a target language');
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await translateText(inputText, settings.sourceLanguage, settings.targetLanguage);
      setTranslatedText(result);
      
      // Animate result appearance
      Animated.timing(resultOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      addTranslation({
        originalText: inputText,
        translatedText: result,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        type: 'text',
      });
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Translation error:', error instanceof Error ? error.message : 'Translation failed');
    }
  };

  const handleSwapLanguages = async () => {
    if (settings.sourceLanguage === 'auto') return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    updateSettings({
      sourceLanguage: settings.targetLanguage,
      targetLanguage: settings.sourceLanguage,
    });
    
    if (translatedText) {
      setInputText(translatedText);
      setTranslatedText(inputText);
    }
  };

  const handleClear = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInputText('');
    setTranslatedText('');
    resultOpacity.setValue(0);
  };

  const handleCopy = async (text: string, type: 'input' | 'output') => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await shareTranslation(
      inputText,
      translatedText,
      settings.sourceLanguage,
      settings.targetLanguage
    );
  };

  const handleSpeak = async (text: string, language: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isSpeaking && currentSpeakingText === text) {
      await stopSpeech();
    } else {
      await speakText(text, language);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Translate</Text>
          {!isOnline && (
            <View style={styles.offlineBadge}>
              <WifiOff size={14} color="#EA4335" />
              <Text style={styles.offlineText}>Offline Mode</Text>
            </View>
          )}
        </View>

        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.languageSelector}>
          <LanguageSelector
            selectedLanguage={settings.sourceLanguage}
            onLanguageSelect={(code) => updateSettings({ sourceLanguage: code })}
            placeholder="Detect Language"
          />
          
          <TouchableOpacity
            onPress={handleSwapLanguages}
            style={[
              styles.swapButton,
              settings.sourceLanguage === 'auto' && styles.swapButtonDisabled
            ]}
            disabled={settings.sourceLanguage === 'auto'}
          >
            <ArrowRightLeft size={20} color={settings.sourceLanguage === 'auto' ? "#9AA0A6" : "#4285F4"} />
          </TouchableOpacity>
          
          <LanguageSelector
            selectedLanguage={settings.targetLanguage}
            onLanguageSelect={(code) => updateSettings({ targetLanguage: code })}
            placeholder="Select Language"
            excludeAuto
          />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Enter text to translate..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            textAlignVertical="top"
            maxLength={5000}
          />
          
          <View style={styles.inputActions}>
            <View style={styles.leftActions}>
              <Text style={styles.charCount}>{inputText.length}/5000</Text>
              {inputText.length > 0 && (
                <>
                  <TouchableOpacity 
                    onPress={() => handleCopy(inputText, 'input')} 
                    style={styles.inputActionButton}
                  >
                    {copied === 'input' ? (
                      <Check size={16} color="#34A853" />
                    ) : (
                      <Copy size={16} color="#9AA0A6" />
                    )}
                  </TouchableOpacity>
                  {Platform.OS !== 'web' && (
                    <TouchableOpacity 
                      onPress={() => handleSpeak(inputText, settings.sourceLanguage)} 
                      style={styles.inputActionButton}
                    >
                      {isSpeaking && currentSpeakingText === inputText ? (
                        <VolumeX size={16} color="#4285F4" />
                      ) : (
                        <Volume2 size={16} color="#9AA0A6" />
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Trash2 size={16} color="#9AA0A6" />
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={[styles.translateButton, (!inputText.trim() || isLoading) && styles.translateButtonDisabled]}
            onPress={() => animateButton(handleTranslate)}
            disabled={!inputText.trim() || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.translateButtonText}>Translating...</Text>
              </View>
            ) : (
              <Text style={styles.translateButtonText}>Translate</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {translatedText && (
          <Animated.View style={[styles.resultContainer, { opacity: resultOpacity }]}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultLabel}>Translation</Text>
              <View style={styles.resultActions}>
                <TouchableOpacity 
                  onPress={() => handleCopy(translatedText, 'output')} 
                  style={styles.resultActionButton}
                >
                  {copied === 'output' ? (
                    <Check size={18} color="#34A853" />
                  ) : (
                    <Copy size={18} color="#5F6368" />
                  )}
                </TouchableOpacity>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity 
                    onPress={() => handleSpeak(translatedText, settings.targetLanguage)} 
                    style={styles.resultActionButton}
                  >
                    {isSpeaking && currentSpeakingText === translatedText ? (
                      <VolumeX size={18} color="#4285F4" />
                    ) : (
                      <Volume2 size={18} color="#5F6368" />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={handleShare} 
                  style={styles.resultActionButton}
                >
                  <Share2 size={18} color="#5F6368" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.resultContent}>
              <Text style={styles.resultText}>{translatedText}</Text>
            </View>
          </Animated.View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#202124',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  offlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EA4335',
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  swapButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  swapButtonDisabled: {
    opacity: 0.5,
  },
  inputContainer: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textInput: {
    padding: 16,
    fontSize: 16,
    color: '#202124',
    minHeight: 120,
    maxHeight: 200,
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#9AA0A6',
  },
  inputActionButton: {
    padding: 4,
  },
  clearButton: {
    padding: 4,
  },
  translateButton: {
    backgroundColor: '#4285F4',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#4285F4',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  translateButtonDisabled: {
    backgroundColor: '#9AA0A6',
    shadowOpacity: 0,
    elevation: 0,
  },
  translateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultContainer: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultActionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  resultContent: {
    padding: 16,
  },
  resultText: {
    fontSize: 18,
    color: '#202124',
    fontWeight: '500',
    lineHeight: 28,
  },
});
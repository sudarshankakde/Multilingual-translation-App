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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRightLeft, Trash2 } from 'lucide-react-native';
import LanguageSelector from '@/components/LanguageSelector';
import TranslationCard from '@/components/TranslationCard';
import { useTranslation } from '@/hooks/translation-store';

export default function TranslateScreen() {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const { settings, updateSettings, translateText, addTranslation, isLoading } = useTranslation();
  const insets = useSafeAreaInsets();

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      console.log('Error: Please enter text to translate');
      return;
    }

    if (settings.targetLanguage === 'auto') {
      console.log('Error: Please select a target language');
      return;
    }

    try {
      const result = await translateText(inputText, settings.sourceLanguage, settings.targetLanguage);
      setTranslatedText(result);

      addTranslation({
        originalText: inputText,
        translatedText: result,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        type: 'text',
      });
    } catch (error) {
      console.error('Translation error:', error instanceof Error ? error.message : 'Translation failed');
    }
  };

  const handleSwapLanguages = () => {
    if (settings.sourceLanguage === 'auto') return;
    
    updateSettings({
      sourceLanguage: settings.targetLanguage,
      targetLanguage: settings.sourceLanguage,
    });
    
    if (translatedText) {
      setInputText(translatedText);
      setTranslatedText(inputText);
    }
  };

  const handleClear = () => {
    setInputText('');
    setTranslatedText('');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Translate</Text>
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
            <Text style={styles.charCount}>{inputText.length}/5000</Text>
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Trash2 size={16} color="#9AA0A6" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.translateButton, (!inputText.trim() || isLoading) && styles.translateButtonDisabled]}
          onPress={handleTranslate}
          disabled={!inputText.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.translateButtonText}>Translate</Text>
          )}
        </TouchableOpacity>

        {translatedText && (
          <View style={styles.resultContainer}>
            <TranslationCard
              translation={{
                id: 'current',
                originalText: inputText,
                translatedText: translatedText,
                sourceLanguage: settings.sourceLanguage,
                targetLanguage: settings.targetLanguage,
                timestamp: Date.now(),
                type: 'text',
              }}
              showLanguages={false}
            />
          </View>
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
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#202124',
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
  charCount: {
    fontSize: 12,
    color: '#9AA0A6',
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
  resultContainer: {
    marginTop: 16,
    marginHorizontal: 16,
  },
});
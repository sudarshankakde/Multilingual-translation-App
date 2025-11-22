import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Animated,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Volume2, Copy, Languages } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from '@/hooks/translation-store';
import LanguageSelector from './LanguageSelector';

interface ScreenTranslationOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export default function ScreenTranslationOverlay({ visible, onClose }: ScreenTranslationOverlayProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { settings, translateText, speakText, addTranslation } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [selectedSourceLang, setSelectedSourceLang] = useState(settings.sourceLanguage);
  const [selectedTargetLang, setSelectedTargetLang] = useState(settings.targetLanguage);

  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, opacity]);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      pan.setOffset({
        x: (pan.x as any)._value,
        y: (pan.y as any)._value,
      });
    },
    onPanResponderMove: Animated.event(
      [null, { dx: pan.x, dy: pan.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: () => {
      pan.flattenOffset();
    },
  });

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      if (Platform.OS === 'web') {
        console.log('Error: Please enter text to translate');
      } else {
        Alert.alert('Error', 'Please enter text to translate');
      }
      return;
    }

    setIsTranslating(true);
    try {
      const result = await translateText(inputText, selectedSourceLang, selectedTargetLang);
      setTranslatedText(result);
      
      addTranslation({
        originalText: inputText,
        translatedText: result,
        sourceLanguage: selectedSourceLang,
        targetLanguage: selectedTargetLang,
        type: 'text',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to translate text';
      if (Platform.OS === 'web') {
        console.error('Translation Error:', errorMessage);
      } else {
        Alert.alert('Translation Error', errorMessage);
      }
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSpeak = async () => {
    if (translatedText) {
      await speakText(translatedText, selectedTargetLang);
    }
  };

  const handleCopy = async () => {
    if (translatedText) {
      await Clipboard.setStringAsync(translatedText);
      if (Platform.OS === 'web') {
        console.log('Translation copied to clipboard');
      } else {
        Alert.alert('Copied', 'Translation copied to clipboard');
      }
    }
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <BlurView intensity={80} style={styles.blurContainer}>
        <Animated.View
          style={[
            styles.container,
            {
              maxWidth: screenWidth - 40,
              maxHeight: screenHeight * 0.8,
              transform: [{ translateX: pan.x }, { translateY: pan.y }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.header}>
            <View style={styles.dragHandle} />
            <Text style={styles.title}>Screen Translator</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color="#5F6368" />
            </TouchableOpacity>
          </View>

          <View style={styles.languageSelector}>
            <TouchableOpacity
              style={styles.languageButton}
              onPress={() => setShowLanguageSelector(true)}
            >
              <Languages size={16} color="#4285F4" />
              <Text style={styles.languageText}>
                {selectedSourceLang === 'auto' ? 'Auto' : selectedSourceLang.toUpperCase()} → {selectedTargetLang.toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Enter text to translate..."
              placeholderTextColor="#9AA0A6"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.translateButton, isTranslating && styles.translateButtonDisabled]}
              onPress={handleTranslate}
              disabled={isTranslating}
            >
              <Text style={styles.translateButtonText}>
                {isTranslating ? 'Translating...' : 'Translate'}
              </Text>
            </TouchableOpacity>
          </View>

          {translatedText ? (
            <View style={styles.resultContainer}>
              <Text style={styles.resultText}>{translatedText}</Text>
              <View style={styles.actionButtons}>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity style={styles.actionButton} onPress={handleSpeak}>
                    <Volume2 size={16} color="#4285F4" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
                  <Copy size={16} color="#4285F4" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </BlurView>

      {showLanguageSelector && (
        <View style={styles.languageSelectorModal}>
          <View style={[styles.languageSelectorContent, { maxWidth: screenWidth - 40 }]}>
            <Text style={styles.selectorTitle}>Select Languages</Text>
            
            <View style={styles.selectorRow}>
              <Text style={styles.selectorLabel}>From:</Text>
              <LanguageSelector
                selectedLanguage={selectedSourceLang}
                onLanguageSelect={setSelectedSourceLang}
              />
            </View>
            
            <View style={styles.selectorRow}>
              <Text style={styles.selectorLabel}>To:</Text>
              <LanguageSelector
                selectedLanguage={selectedTargetLang}
                onLanguageSelect={setSelectedTargetLang}
                excludeAuto
              />
            </View>
            
            <TouchableOpacity
              style={styles.selectorCloseButton}
              onPress={() => setShowLanguageSelector(false)}
            >
              <Text style={styles.selectorCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dragHandle: {
    width: 32,
    height: 4,
    backgroundColor: '#E8EAED',
    borderRadius: 2,
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
  },
  closeButton: {
    padding: 4,
  },
  languageSelector: {
    marginBottom: 16,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  languageText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#4285F4',
  },
  inputContainer: {
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E8EAED',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#202124',
    backgroundColor: '#FFFFFF',
    minHeight: 80,
    maxHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  translateButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  translateButtonDisabled: {
    backgroundColor: '#9AA0A6',
  },
  translateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  resultText: {
    fontSize: 16,
    color: '#202124',
    lineHeight: 24,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  languageSelectorModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageSelectorContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 20,
    textAlign: 'center',
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#5F6368',
    width: 60,
  },
  selectorCloseButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  selectorCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { Copy, Volume2, Share2, VolumeX, Check, Pause, Play, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Translation } from '@/types/translation';
import { getLanguageName } from '@/constants/languages';
import { useTranslation } from '@/hooks/translation-store';

interface TranslationCardProps {
  translation: Translation;
  showLanguages?: boolean;
}

export default function TranslationCard({ 
  translation, 
  showLanguages = true 
}: TranslationCardProps) {
  const { speakText, stopSpeech, pauseSpeech, resumeSpeech, copyToClipboard, shareTranslation, isSpeaking, currentSpeakingText } = useTranslation();
  const [copiedText, setCopiedText] = useState<string>('');
  const [isPaused, setIsPaused] = useState(false);
  const scaleAnim = useState(new Animated.Value(1))[0];

  const isThisTextSpeaking = currentSpeakingText === translation.originalText || currentSpeakingText === translation.translatedText;

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCopy = async (text: string, type: 'original' | 'translated') => {
    animateButton();
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedText(type);
      setTimeout(() => setCopiedText(''), 2000);
    }
  };

  const handleSpeak = async (text: string, language: string) => {
    animateButton();
    if (isThisTextSpeaking && isSpeaking && !isPaused) {
      // Stop if currently speaking this text
      await stopSpeech();
      setIsPaused(false);
    } else {
      // Start speaking
      setIsPaused(false);
      await speakText(text, language);
    }
  };

  const handlePause = async () => {
    animateButton();
    if (isPaused) {
      await resumeSpeech();
      setIsPaused(false);
    } else {
      await pauseSpeech();
      setIsPaused(true);
    }
  };

  const handleStop = async () => {
    animateButton();
    await stopSpeech();
    setIsPaused(false);
  };

  const handleShare = async () => {
    animateButton();
    await shareTranslation(
      translation.originalText,
      translation.translatedText,
      getLanguageName(translation.sourceLanguage),
      getLanguageName(translation.targetLanguage)
    );
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      {showLanguages && (
        <View style={styles.languageHeader}>
          <Text style={styles.languageText}>
            {getLanguageName(translation.sourceLanguage)} → {getLanguageName(translation.targetLanguage)}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(translation.timestamp).toLocaleDateString()}
          </Text>
        </View>
      )}

      <View style={styles.textSection}>
        <View style={styles.textContainer}>
          <Text style={styles.originalText}>{translation.originalText}</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={() => handleCopy(translation.originalText, 'original')}
              style={styles.actionButton}
            >
              {copiedText === 'original' ? (
                <Check size={16} color="#34A853" />
              ) : (
                <Copy size={16} color="#5F6368" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSpeak(translation.originalText, translation.sourceLanguage)}
              style={[styles.actionButton, isThisTextSpeaking && currentSpeakingText === translation.originalText && styles.actionButtonActive]}
            >
              {isThisTextSpeaking && currentSpeakingText === translation.originalText && isSpeaking ? (
                <VolumeX size={16} color="#4285F4" />
              ) : (
                <Volume2 size={16} color={isThisTextSpeaking && currentSpeakingText === translation.originalText ? "#4285F4" : "#5F6368"} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.textContainer}>
          <Text style={styles.translatedText}>{translation.translatedText}</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={() => handleCopy(translation.translatedText, 'translated')}
              style={styles.actionButton}
            >
              {copiedText === 'translated' ? (
                <Check size={16} color="#34A853" />
              ) : (
                <Copy size={16} color="#5F6368" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSpeak(translation.translatedText, translation.targetLanguage)}
              style={[styles.actionButton, isThisTextSpeaking && currentSpeakingText === translation.translatedText && styles.actionButtonActive]}
            >
              {isThisTextSpeaking && currentSpeakingText === translation.translatedText && isSpeaking ? (
                <VolumeX size={16} color="#4285F4" />
              ) : (
                <Volume2 size={16} color={isThisTextSpeaking && currentSpeakingText === translation.translatedText ? "#4285F4" : "#5F6368"} />
              )}
            </TouchableOpacity>
            {isThisTextSpeaking && isSpeaking && (
              <TouchableOpacity
                onPress={handlePause}
                style={styles.actionButton}
              >
                {isPaused ? (
                  <Play size={16} color="#4285F4" />
                ) : (
                  <Pause size={16} color="#4285F4" />
                )}
              </TouchableOpacity>
            )}
            {isThisTextSpeaking && (
              <TouchableOpacity
                onPress={handleStop}
                style={styles.actionButton}
              >
                <Square size={16} color="#EA4335" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleShare}
              style={styles.actionButton}
            >
              <Share2 size={16} color="#5F6368" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  languageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  languageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
  },
  timestamp: {
    fontSize: 12,
    color: '#9AA0A6',
  },
  textSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  originalText: {
    flex: 1,
    fontSize: 16,
    color: '#202124',
    lineHeight: 24,
    marginRight: 12,
  },
  translatedText: {
    flex: 1,
    fontSize: 16,
    color: '#202124',
    fontWeight: '500',
    lineHeight: 24,
    marginRight: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 20,
  },
  actionButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8EAED',
    marginVertical: 12,
  },
});
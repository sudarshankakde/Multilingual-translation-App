import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Copy, Volume2, Share2 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import * as Sharing from 'expo-sharing';
import { Translation } from '@/types/translation';
import { getLanguageName } from '@/constants/languages';

interface TranslationCardProps {
  translation: Translation;
  showLanguages?: boolean;
}

export default function TranslationCard({ 
  translation, 
  showLanguages = true 
}: TranslationCardProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      console.log('Text copied to clipboard');
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const handleSpeak = async (text: string, language: string) => {
    if (Platform.OS === 'web') {
      console.log('Text-to-speech is not available on web');
      return;
    }

    try {
      if (isSpeaking) {
        Speech.stop();
        setIsSpeaking(false);
        return;
      }

      setIsSpeaking(true);
      await Speech.speak(text, {
        language: language === 'auto' ? 'en' : language,
        rate: 0.8,
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (error) {
      console.error('Failed to speak text:', error);
      setIsSpeaking(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareText = `Original: ${translation.originalText}\n\nTranslation: ${translation.translatedText}`;
      
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({
            title: 'Translation',
            text: shareText,
          });
        } else {
          await Clipboard.setStringAsync(shareText);
          console.log('Translation copied to clipboard');
        }
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(shareText);
        } else {
          await Clipboard.setStringAsync(shareText);
          console.log('Translation copied to clipboard');
        }
      }
    } catch (error) {
      console.error('Failed to share translation:', error);
    }
  };

  return (
    <View style={styles.container}>
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
              onPress={() => handleCopy(translation.originalText)}
              style={styles.actionButton}
            >
              <Copy size={16} color="#5F6368" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSpeak(translation.originalText, translation.sourceLanguage)}
              style={styles.actionButton}
            >
              <Volume2 size={16} color={isSpeaking ? "#4285F4" : "#5F6368"} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.textContainer}>
          <Text style={styles.translatedText}>{translation.translatedText}</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={() => handleCopy(translation.translatedText)}
              style={styles.actionButton}
            >
              <Copy size={16} color="#5F6368" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSpeak(translation.translatedText, translation.targetLanguage)}
              style={styles.actionButton}
            >
              <Volume2 size={16} color="#5F6368" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShare}
              style={styles.actionButton}
            >
              <Share2 size={16} color="#5F6368" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
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
  },
  divider: {
    height: 1,
    backgroundColor: '#E8EAED',
    marginVertical: 12,
  },
});
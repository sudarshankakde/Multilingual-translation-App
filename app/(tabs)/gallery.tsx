import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Images, Upload, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from '@/hooks/translation-store';
import TranslationCard from '@/components/TranslationCard';
import LanguageSelector from '@/components/LanguageSelector';

export default function GalleryScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranslation, setLastTranslation] = useState<any>(null);
  const { settings, translateText, addTranslation, updateSettings } = useTranslation();
  const insets = useSafeAreaInsets();

  const extractTextFromImage = async (imageUri: string): Promise<string> => {
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
              content: 'Extract all text from this image. Return only the extracted text, nothing else. If no text is found, return "No text found".'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  image: imageUri
                }
              ]
            }
          ]
        }),
      });

      const data = await response.json();
      return data.completion || 'No text found';
    } catch (error) {
      console.error('Text extraction failed:', error);
      throw new Error('Failed to extract text from image');
    }
  };

  const processImage = async (imageUri: string) => {
    if (settings.targetLanguage === 'auto') {
      console.log('Error: Please select a target language');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('Extracting text from image...');
      const extractedText = await extractTextFromImage(imageUri);
      
      if (extractedText === 'No text found' || !extractedText.trim()) {
        console.log('No text was detected in the image');
        return;
      }

      console.log('Translating extracted text...');
      const translatedText = await translateText(extractedText, settings.sourceLanguage, settings.targetLanguage);

      const translation = {
        id: Date.now().toString(),
        originalText: extractedText,
        translatedText: translatedText,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        timestamp: Date.now(),
        type: 'gallery' as const,
      };

      setLastTranslation(translation);
      addTranslation(translation);
    } catch (error) {
      console.error('Image processing error:', error instanceof Error ? error.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await processImage(base64Image);
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await processImage(base64Image);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Gallery Translator</Text>
        <Text style={styles.subtitle}>Select images to extract and translate text</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.languageSection}>
          <Text style={styles.sectionTitle}>Translation Settings</Text>
          <View style={styles.languageRow}>
            <View style={styles.languageItem}>
              <Text style={styles.languageLabel}>From</Text>
              <LanguageSelector
                selectedLanguage={settings.sourceLanguage}
                onLanguageSelect={(code) => updateSettings({ sourceLanguage: code })}
                placeholder="Auto-detect"
              />
            </View>
            <View style={styles.languageItem}>
              <Text style={styles.languageLabel}>To</Text>
              <LanguageSelector
                selectedLanguage={settings.targetLanguage}
                onLanguageSelect={(code) => updateSettings({ targetLanguage: code })}
                placeholder="Select language"
                excludeAuto
              />
            </View>
          </View>
        </View>

        <View style={styles.actionsSection}>
          <View style={styles.actionCard}>
            <View style={styles.actionIcon}>
              <Images size={48} color="#4285F4" />
            </View>
            <Text style={styles.actionTitle}>Select from Gallery</Text>
            <Text style={styles.actionDescription}>
              Choose an existing image from your photo library
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, (isProcessing || settings.targetLanguage === 'auto') && styles.actionButtonDisabled]}
              onPress={pickImageFromGallery}
              disabled={isProcessing || settings.targetLanguage === 'auto'}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Upload size={20} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Select Image</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {Platform.OS !== 'web' && (
            <View style={styles.actionCard}>
              <View style={styles.actionIcon}>
                <Camera size={48} color="#34A853" />
              </View>
              <Text style={styles.actionTitle}>Take Photo</Text>
              <Text style={styles.actionDescription}>
                Capture a new photo with text to translate
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary, (isProcessing || settings.targetLanguage === 'auto') && styles.actionButtonDisabled]}
                onPress={takePhoto}
                disabled={isProcessing || settings.targetLanguage === 'auto'}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Camera size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Take Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {settings.targetLanguage === 'auto' && (
          <View style={styles.warningSection}>
            <Text style={styles.warningText}>
              Please select a target language above to enable translation
            </Text>
          </View>
        )}

        {lastTranslation && (
          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>Translation Result</Text>
            <TranslationCard translation={lastTranslation} />
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Supported Features</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Extract text from any image format</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Translate to 100+ languages</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Save translations to history</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Text-to-speech for translations</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
  subtitle: {
    fontSize: 14,
    color: '#5F6368',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  languageSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  languageRow: {
    flexDirection: 'row',
    gap: 16,
  },
  languageItem: {
    flex: 1,
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5F6368',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 16,
  },
  actionsSection: {
    marginTop: 16,
    marginHorizontal: 16,
    gap: 16,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 8,
  },
  actionDescription: {
    fontSize: 14,
    color: '#5F6368',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: '#34A853',
  },
  actionButtonDisabled: {
    backgroundColor: '#9AA0A6',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  warningSection: {
    margin: 16,
    backgroundColor: '#FEF7E0',
    borderRadius: 8,
    padding: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#F9AB00',
    textAlign: 'center',
  },
  resultSection: {
    margin: 16,
  },
  infoSection: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 16,
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureBullet: {
    fontSize: 16,
    color: '#4285F4',
    marginRight: 12,
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: '#5F6368',
    lineHeight: 20,
  },
});
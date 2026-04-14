import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Images, Upload, Camera, Languages, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from '@/hooks/translation-store';
import TranslationCard from '@/components/TranslationCard';
import LanguageSelector from '@/components/LanguageSelector';
import OfflineScreen from '@/components/OfflineScreen';
import { extractTextFromImageBase64 } from '@/utils/gemini';
import { getLanguageName } from '@/constants/languages';

export default function GalleryScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [lastTranslation, setLastTranslation] = useState<any>(null);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { settings, translateText, addTranslation, updateSettings, isOffline, shouldPromptTargetLanguageChange } = useTranslation();
  const insets = useSafeAreaInsets();

  if (isOffline) {
    return <OfflineScreen message="Gallery translation requires an internet connection to extract and translate text from images." />;
  }

  const extractTextFromImage = async (imageUri: string): Promise<string> => {
    let base64Data = imageUri;
    if (imageUri.includes('base64,')) base64Data = imageUri.split('base64,')[1];
    else if (imageUri.includes(',')) base64Data = imageUri.split(',')[1];
    const result = await extractTextFromImageBase64(base64Data);
    console.log(`Gemini used model: ${result.modelTried} attempts:${result.attempts}`);
    return result.text;
  };

  const processImage = async (imageUri: string) => {
    if (settings.targetLanguage === 'auto') {
      console.log('Error: Please select a target language');
      return;
    }

    // Check if offline before attempting image processing
    if (isOffline) {
      Alert.alert(
        'Offline Mode',
        'Gallery translation requires an internet connection to extract and translate text from images. This feature is not available in offline mode.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsProcessing(true);
    try {
      setProcessingStep('Extracting text from image...');
      console.log('Extracting text from image...');
      const extractedText = await extractTextFromImage(imageUri);
      
      if (extractedText === 'No text found' || !extractedText.trim()) {
        console.log('No text was detected in the image');
        return;
      }

      const languageCheck = await shouldPromptTargetLanguageChange(
        extractedText,
        settings.sourceLanguage,
        settings.targetLanguage
      );
      if (languageCheck.shouldPrompt) {
        Alert.alert(
          'Change Target Language',
          `Detected source language is ${getLanguageName(languageCheck.detectedLanguage || settings.targetLanguage)}. Please choose a different target language.`
        );
        return;
      }

      setProcessingStep('Translating extracted text...');
      console.log('Translating extracted text...');
      const translatedText = await translateText(extractedText, settings.sourceLanguage, settings.targetLanguage);

      setProcessingStep('Saving translation...');
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
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    } catch (error) {
      console.error('Image processing error:', error instanceof Error ? error.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const pickImageFromGallery = async () => {
    if (isOffline) {
      Alert.alert(
        'Offline Mode',
        'Gallery translation requires an internet connection. This feature is not available in offline mode.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        
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
    // Check if offline before attempting to take photo
    if (isOffline) {
      Alert.alert(
        'Offline Mode',
        'Camera translation requires an internet connection. This feature is not available in offline mode.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
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

  const retranslateWithNewLanguage = async (newTargetLanguage: string) => {
    if (isProcessing || !lastTranslation || newTargetLanguage === lastTranslation.targetLanguage) {
      return;
    }

    const languageCheck = await shouldPromptTargetLanguageChange(
      lastTranslation.originalText,
      lastTranslation.sourceLanguage,
      newTargetLanguage
    );
    if (languageCheck.shouldPrompt) {
      Alert.alert(
        'Change Target Language',
        `Detected source language is ${getLanguageName(languageCheck.detectedLanguage || newTargetLanguage)}. Please choose a different target language.`
      );
      return;
    }

    updateSettings({ targetLanguage: newTargetLanguage });
    setIsProcessing(true);

    try {
      const translatedText = await translateText(
        lastTranslation.originalText,
        lastTranslation.sourceLanguage,
        newTargetLanguage
      );

      const updatedTranslation = {
        ...lastTranslation,
        translatedText,
        targetLanguage: newTargetLanguage,
        timestamp: Date.now(),
      };

      setLastTranslation(updatedTranslation);
      addTranslation({
        originalText: lastTranslation.originalText,
        translatedText,
        sourceLanguage: lastTranslation.sourceLanguage,
        targetLanguage: newTargetLanguage,
        type: 'gallery',
      });
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    } catch (error) {
      console.error('Retranslation error:', error instanceof Error ? error.message : 'Retranslation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Gallery Translator</Text>
            <Text style={styles.subtitle}>Select images to extract and translate text</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsIconButton}
            onPress={() => !isProcessing && setSettingsModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open translation settings"
            disabled={isProcessing}
          >
            <Languages size={20} color="#4285F4" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.languageSummarySection} onPress={() => !isProcessing && setSettingsModalVisible(true)} activeOpacity={0.85} disabled={isProcessing}>
        <View style={styles.languageBadge}>
          <Text style={styles.languageBadgeLabel}>From</Text>
          <Text style={styles.languageBadgeValue}>{getLanguageName(settings.sourceLanguage)}</Text>
        </View>
        <View style={styles.languageArrowWrap}>
          <Text style={styles.languageArrow}>→</Text>
        </View>
        <View style={styles.languageBadge}>
          <Text style={styles.languageBadgeLabel}>To</Text>
          <Text style={styles.languageBadgeValue}>{getLanguageName(settings.targetLanguage)}</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={settingsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Translation Settings</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)} style={styles.modalCloseButton}>
                <X size={20} color="#5F6368" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalLanguageSection}>
              <Text style={styles.modalLanguageLabel}>From</Text>
              <LanguageSelector
                selectedLanguage={settings.sourceLanguage}
                onLanguageSelect={(code) => updateSettings({ sourceLanguage: code })}
                placeholder="Auto-detect"
                disabled={isProcessing}
              />
            </View>

            <View style={styles.modalLanguageSection}>
              <Text style={styles.modalLanguageLabel}>To</Text>
              <LanguageSelector
                selectedLanguage={settings.targetLanguage}
                onLanguageSelect={(code) => updateSettings({ targetLanguage: code })}
                placeholder="Select language"
                excludeAuto
                disabled={isProcessing}
              />
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView 
        ref={scrollRef}
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.actionsSection, Platform.OS !== 'web' && styles.actionsSectionRow]}>
          <View style={styles.actionCard}>
            <View style={styles.actionIcon}>
              <Images size={32} color="#4285F4" />
            </View>
            <Text style={styles.actionTitle}>Gallery</Text>
            <Text style={styles.actionDescription}>
              Pick photo
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, (isProcessing || settings.targetLanguage === 'auto' || isOffline) && styles.actionButtonDisabled]}
              onPress={pickImageFromGallery}
              disabled={isProcessing || settings.targetLanguage === 'auto' || isOffline}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Upload size={20} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>
                    {isOffline ? 'Offline' : 'Select'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {Platform.OS !== 'web' && (
            <View style={styles.actionCard}>
              <View style={styles.actionIcon}>
                <Camera size={32} color="#34A853" />
              </View>
              <Text style={styles.actionTitle}>Camera</Text>
              <Text style={styles.actionDescription}>
                Capture text
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary, (isProcessing || settings.targetLanguage === 'auto' || isOffline) && styles.actionButtonDisabled]}
                onPress={takePhoto}
                disabled={isProcessing || settings.targetLanguage === 'auto' || isOffline}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Camera size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>
                      {isOffline ? 'Offline' : 'Capture'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {isProcessing && (
          <View style={styles.processingBanner}>
            <ActivityIndicator size="small" color="#4285F4" />
            <Text style={styles.processingBannerText}>{processingStep || 'Processing image...'}</Text>
          </View>
        )}

        {settings.targetLanguage === 'auto' && !isOffline && (
          <View style={styles.warningSection}>
            <Text style={styles.warningText}>
              Please select a target language above to enable translation
            </Text>
          </View>
        )}
        
        {isOffline && (
          <View style={[styles.warningSection, styles.offlineWarning]}>
            <Text style={[styles.warningText, styles.offlineWarningText]}>
              📡 Gallery translation is not available in offline mode
            </Text>
          </View>
        )}

        {lastTranslation && (
          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>Translation Result</Text>
            <View style={styles.resultLanguageSection}>
              <Text style={styles.resultLanguageLabel}>Change Output Language</Text>
              <LanguageSelector
                selectedLanguage={lastTranslation.targetLanguage}
                onLanguageSelect={retranslateWithNewLanguage}
                placeholder="Select language"
                excludeAuto
                disabled={isProcessing}
              />
            </View>
            <TranslationCard translation={lastTranslation} />
          </View>
        )}
  {
          !lastTranslation  &&( <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Supported Features</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Extract text from any image format</Text>
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
        </View>)
  }
       
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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  settingsIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
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
  languageSummarySection: {
    marginTop: 12,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  languageBadge: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  languageBadgeLabel: {
    fontSize: 11,
    color: '#5F6368',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  languageBadgeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
  },
  languageArrowWrap: {
    width: 22,
    alignItems: 'center',
  },
  languageArrow: {
    fontSize: 16,
    color: '#5F6368',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F3F4',
  },
  modalLanguageSection: {
    gap: 8,
  },
  modalLanguageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5F6368',
  },
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#E8F0FE',
  },
  processingBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#202124',
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
  actionsSectionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 12,
    color: '#5F6368',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonSecondary: {
    backgroundColor: '#34A853',
  },
  actionButtonDisabled: {
    backgroundColor: '#9AA0A6',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
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
  resultLanguageSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  resultLanguageLabel: {
    fontSize: 13,
    color: '#5F6368',
    fontWeight: '500',
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
  offlineWarning: {
    backgroundColor: '#FEE',
  },
  offlineWarningText: {
    color: '#EA4335',
    fontWeight: '500',
  },
});
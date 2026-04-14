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
import { FileText, Upload, Languages, X } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import { useTranslation } from '@/hooks/translation-store';
import TranslationCard from '@/components/TranslationCard';
import LanguageSelector from '@/components/LanguageSelector';
import OfflineScreen from '@/components/OfflineScreen';
import { extractTextFromPdfBase64 } from '@/utils/gemini';
import { getLanguageName } from '@/constants/languages';

export default function PDFScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [lastTranslation, setLastTranslation] = useState<any>(null);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { settings, translateText, addTranslation, updateSettings, isOffline, shouldPromptTargetLanguageChange } = useTranslation();
  const insets = useSafeAreaInsets();

  if (isOffline) {
    return <OfflineScreen message="PDF translation requires an internet connection to extract and translate text from documents." />;
  }

  // Removed local Gemini fetch; now using centralized helper with fallback logic

  const pickAndProcessPDF = async () => {
    // Check if offline before attempting upload
    if (isOffline) {
      Alert.alert(
        'Offline Mode',
        'PDF translation requires an internet connection. This feature is not available in offline mode.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      // Check file size (warn if > 5MB)
      const fileSize = asset.size || 0;
      if (fileSize > 5 * 1024 * 1024) {
        Alert.alert(
          'Large File Warning',
          `This PDF is ${(fileSize / (1024 * 1024)).toFixed(1)}MB. Large files may take longer to process or fail. Continue anyway?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => {} },
            { text: 'Continue', onPress: () => processPDFFile(asset) }
          ]
        );
        return;
      }

      await processPDFFile(asset);
    } catch (error) {
      console.error('PDF processing failed:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const processPDFFile = async (asset: any) => {
    try {
      setIsProcessing(true);
      console.log('Processing PDF:', asset.name, 'Size:', asset.size);
      setProcessingStep('Reading PDF file...');

      let base64Data: string;
      
      if (Platform.OS === 'web') {
        try {
          let fileToRead: File | Blob;
          
          if ('file' in asset && asset.file) {
            fileToRead = asset.file as File;
          } else {
            const response = await fetch(asset.uri);
            fileToRead = await response.blob();
          }
          
          const reader = new FileReader();
          
          base64Data = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(fileToRead);
          });
        } catch (error) {
          console.error('Web file reading failed:', error);
          Alert.alert('Error', 'Failed to read PDF file on web. Please try a different file.');
          return;
        }
      } else {
        try {
          const base64 = await readAsStringAsync(asset.uri, {
            encoding: EncodingType.Base64,
          });
          base64Data = `data:application/pdf;base64,${base64}`;
        } catch (error) {
          console.error('Mobile file reading failed:', error);
          Alert.alert('Error', 'Failed to read PDF file. Please try again.');
          return;
        }
      }

      console.log('Extracting text from PDF via helper...');
      let text: string;
      try {
        setProcessingStep('Extracting text from PDF...');
        let rawBase64 = base64Data;
        if (rawBase64.includes('base64,')) rawBase64 = rawBase64.split('base64,')[1];
        else if (rawBase64.includes(',')) rawBase64 = rawBase64.split(',')[1];
        const result = await extractTextFromPdfBase64(rawBase64);
        console.log(`Gemini used model: ${result.modelTried} attempts:${result.attempts}`);
        text = result.text;
      } catch (extractError) {
        console.error('Extraction error:', extractError);
        Alert.alert(
          'Extraction Failed',
          extractError instanceof Error ? extractError.message : 'Could not extract text from PDF. The file may be encrypted, corrupted, or contain only images without text layers.',
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        return;
      }
      
      if (text === 'No text found' || !text.trim()) {
        Alert.alert(
          'No Text Found',
          'No readable text was detected in the PDF document. The PDF may contain only images or scanned pages without text layers.',
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        return;
      }
      
      console.log(`Successfully extracted ${text.length} characters`);

      setExtractedText(text);

      if (settings.targetLanguage !== 'auto') {
        setProcessingStep('Translating extracted text...');
        const languageCheck = await shouldPromptTargetLanguageChange(
          text,
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

        console.log('Translating extracted text...');
        const translatedText = await translateText(text, settings.sourceLanguage, settings.targetLanguage);

        setProcessingStep('Saving translation...');
        const translation = {
          id: Date.now().toString(),
          originalText: text,
          translatedText: translatedText,
          sourceLanguage: settings.sourceLanguage,
          targetLanguage: settings.targetLanguage,
          timestamp: Date.now(),
          type: 'pdf' as const,
        };

        setLastTranslation(translation);
        addTranslation(translation);
        requestAnimationFrame(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        });
      } else {
        Alert.alert('Success', 'Text extracted successfully. Please select a target language to translate.');
      }
    } catch (error) {
      console.error('PDF processing in helper failed:', error);
      throw error;
    }
  };

  const translateExtractedText = async () => {
    if (!extractedText || settings.targetLanguage === 'auto') {
      console.log('Error: Please select a target language');
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

    // Check if offline before attempting translation
    if (isOffline) {
      Alert.alert(
        'Offline Mode',
        'PDF translation requires an internet connection. This feature is not available in offline mode.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsProcessing(true);
    try {
      const translatedText = await translateText(extractedText, settings.sourceLanguage, settings.targetLanguage);

      const translation = {
        id: Date.now().toString(),
        originalText: extractedText,
        translatedText: translatedText,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        timestamp: Date.now(),
        type: 'pdf' as const,
      };

      setLastTranslation(translation);
      addTranslation(translation);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    } catch (error) {
      console.error('Translation error:', error instanceof Error ? error.message : 'Translation failed');
    } finally {
      setIsProcessing(false);
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
    setProcessingStep('Retranslating extracted text...');

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
        type: 'pdf',
      });
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    } catch (error) {
      console.error('Retranslation error:', error instanceof Error ? error.message : 'Retranslation failed');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>PDF Translator</Text>
            <Text style={styles.subtitle}>Upload and translate PDF documents</Text>
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
        <View style={styles.uploadSection}>
          <View style={styles.uploadIcon}>
            <FileText size={34} color="#4285F4" />
          </View>

          <View style={styles.uploadContent}>
            <Text style={styles.uploadTitle}>Select PDF Document</Text>
            <Text style={styles.uploadDescription}>
              Choose a PDF file to extract and translate its text content
            </Text>

            <TouchableOpacity
              style={[styles.uploadButton, (isProcessing || isOffline) && styles.uploadButtonDisabled]}
              onPress={pickAndProcessPDF}
              disabled={isProcessing || isOffline}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Upload size={18} color="#FFFFFF" />
                  <Text style={styles.uploadButtonText}>
                    {isOffline ? 'Offline - Unavailable' : 'Select PDF'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {isOffline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerText}>
                📡 PDF translation is not available offline
              </Text>
            </View>
          )}
        </View>

        {isProcessing && (
          <View style={styles.processingBanner}>
            <ActivityIndicator size="small" color="#4285F4" />
            <Text style={styles.processingBannerText}>{processingStep || 'Processing PDF...'}</Text>
          </View>
        )}

        {extractedText && !lastTranslation && (
          <View style={styles.extractedSection}>
            <Text style={styles.sectionTitle}>Extracted Text</Text>
            <View style={styles.textContainer}>
              <Text style={styles.extractedText} numberOfLines={10}>
                {extractedText}
              </Text>
            </View>
            
            <TouchableOpacity
              style={[styles.translateButton, isProcessing && styles.translateButtonDisabled]}
              onPress={translateExtractedText}
              disabled={isProcessing || settings.targetLanguage === 'auto'}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.translateButtonText}>Translate Text</Text>
              )}
            </TouchableOpacity>

            {settings.targetLanguage === 'auto' && (
              <Text style={styles.warningText}>
                Please select a target language above to translate
              </Text>
            )}
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
  {!lastTranslation && !extractedText &&( <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Supported Features</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Extract text from PDF documents</Text>
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
        </View>)}
       
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
  uploadSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    marginBottom: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  uploadContent: {
    flex: 1,
    gap: 8,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
  },
  uploadDescription: {
    fontSize: 13,
    color: '#5F6368',
    lineHeight: 18,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#4285F4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 2,
  },
  uploadButtonDisabled: {
    backgroundColor: '#9AA0A6',
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  extractedSection: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 16,
  },
  textContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    maxHeight: 200,
  },
  extractedText: {
    fontSize: 14,
    color: '#202124',
    lineHeight: 20,
  },
  translateButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 12,
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
  warningText: {
    fontSize: 12,
    color: '#EA4335',
    textAlign: 'center',
    marginTop: 8,
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
  offlineBanner: {
    backgroundColor: '#FEF7E0',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  offlineBannerText: {
    fontSize: 13,
    color: '#F9AB00',
    textAlign: 'center',
    fontWeight: '500',
  },
});
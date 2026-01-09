import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Upload } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from '@/hooks/translation-store';
import TranslationCard from '@/components/TranslationCard';
import LanguageSelector from '@/components/LanguageSelector';
import OfflineScreen from '@/components/OfflineScreen';
import { extractTextFromPdfBase64 } from '@/utils/gemini';

export default function PDFScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [lastTranslation, setLastTranslation] = useState<any>(null);
  const { settings, translateText, addTranslation, updateSettings, isOffline } = useTranslation();
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
          if (!FileSystem.readAsStringAsync) {
            throw new Error('FileSystem not available');
          }
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
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
        console.log('Translating extracted text...');
        const translatedText = await translateText(text, settings.sourceLanguage, settings.targetLanguage);

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
    } catch (error) {
      console.error('Translation error:', error instanceof Error ? error.message : 'Translation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>PDF Translator</Text>
        <Text style={styles.subtitle}>Upload and translate PDF documents</Text>
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

        <View style={styles.uploadSection}>
          <View style={styles.uploadIcon}>
            <FileText size={48} color="#4285F4" />
          </View>
          
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
                <Upload size={20} color="#FFFFFF" />
                <Text style={styles.uploadButtonText}>
                  {isOffline ? 'Offline - Unavailable' : 'Select PDF'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {isOffline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerText}>
                📡 PDF translation is not available offline
              </Text>
            </View>
          )}
        </View>

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
            <TranslationCard translation={lastTranslation} />
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Supported Features</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Extract text from PDF documents</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Translate extracted text to any language</Text>
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
  uploadSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    marginTop: 16,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 8,
  },
  uploadDescription: {
    fontSize: 14,
    color: '#5F6368',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: '#9AA0A6',
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
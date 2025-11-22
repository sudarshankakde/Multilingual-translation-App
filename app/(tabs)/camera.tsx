import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Camera, FlipHorizontal, Zap, ZapOff, Images, Settings } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from '@/hooks/translation-store';
import TranslationCard from '@/components/TranslationCard';
import LanguageSelector from '@/components/LanguageSelector';

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranslation, setLastTranslation] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { settings, translateText, addTranslation, updateSettings } = useTranslation();

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Camera size={64} color="#9AA0A6" />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to capture and translate text from images
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => !current);
  };

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
        type: 'camera' as const,
      };

      setLastTranslation(translation);
      addTranslation(translation);
    } catch (error) {
      console.error('Image processing error:', error instanceof Error ? error.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });

      if (photo?.base64) {
        const base64Image = `data:image/jpeg;base64,${photo.base64}`;
        await processImage(base64Image);
      }
    } catch (error) {
      console.error('Failed to take picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const pickImage = async () => {
    if (settings.targetLanguage === 'auto') {
      setShowSettings(true);
      return;
    }

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

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.webScrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.webContainer}>
            <Camera size={64} color="#9AA0A6" />
            <Text style={styles.webTitle}>Camera Translation</Text>
            <Text style={styles.webText}>
              Camera features are limited on web. Use gallery to select and translate images.
            </Text>
            
            <View style={styles.webLanguageSection}>
              <Text style={styles.webLanguageTitle}>Translation Settings</Text>
              <View style={styles.webLanguageRow}>
                <View style={styles.webLanguageItem}>
                  <Text style={styles.webLanguageLabel}>From</Text>
                  <LanguageSelector
                    selectedLanguage={settings.sourceLanguage}
                    onLanguageSelect={(code) => updateSettings({ sourceLanguage: code })}
                    placeholder="Auto-detect"
                  />
                </View>
                <View style={styles.webLanguageItem}>
                  <Text style={styles.webLanguageLabel}>To</Text>
                  <LanguageSelector
                    selectedLanguage={settings.targetLanguage}
                    onLanguageSelect={(code) => updateSettings({ targetLanguage: code })}
                    placeholder="Select language"
                    excludeAuto
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.webButton, settings.targetLanguage === 'auto' && styles.webButtonDisabled]} 
              onPress={pickImage}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Images size={20} color="#FFFFFF" />
                  <Text style={styles.webButtonText}>Select Image from Gallery</Text>
                </>
              )}
            </TouchableOpacity>
            
            {settings.targetLanguage === 'auto' && (
              <Text style={styles.webWarningText}>
                Please select a target language above
              </Text>
            )}
            
            {isProcessing && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#4285F4" />
                <Text style={styles.processingText}>Processing image...</Text>
              </View>
            )}
            
            {lastTranslation && (
              <View style={styles.webResultContainer}>
                <Text style={styles.webResultTitle}>Translation Result</Text>
                <TranslationCard translation={lastTranslation} />
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {showSettings && (
        <View style={styles.settingsOverlay}>
          <View style={styles.settingsModal}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Translation Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.settingsContent}>
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>From</Text>
                <LanguageSelector
                  selectedLanguage={settings.sourceLanguage}
                  onLanguageSelect={(code) => updateSettings({ sourceLanguage: code })}
                  placeholder="Auto-detect"
                />
              </View>
              
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>To</Text>
                <LanguageSelector
                  selectedLanguage={settings.targetLanguage}
                  onLanguageSelect={(code) => {
                    updateSettings({ targetLanguage: code });
                    if (code !== 'auto') {
                      setShowSettings(false);
                    }
                  }}
                  placeholder="Select language"
                  excludeAuto
                />
              </View>
            </View>
          </View>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Camera Translate</Text>
            <Text style={styles.subtitle}>Point camera at text to translate</Text>
          </View>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsButton}>
            <Settings size={24} color="#4285F4" />
          </TouchableOpacity>
        </View>
        
        {settings.targetLanguage === 'auto' && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningBannerText}>
              Please select a target language to enable translation
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          flash={flash ? 'on' : 'off'}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.topControls}>
              <TouchableOpacity onPress={toggleFlash} style={styles.controlButton}>
                {flash ? (
                  <Zap size={24} color="#FFFFFF" />
                ) : (
                  <ZapOff size={24} color="#FFFFFF" />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleCameraFacing} style={styles.controlButton}>
                <FlipHorizontal size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.focusFrame}>
              <Text style={styles.focusFrameText}>Align text within this frame</Text>
            </View>

            <View style={styles.bottomControls}>
              <TouchableOpacity onPress={pickImage} style={styles.galleryButton}>
                <Images size={20} color="#FFFFFF" />
                <Text style={styles.galleryButtonText}>Gallery</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={takePicture}
                style={[styles.captureButton, (isProcessing || settings.targetLanguage === 'auto') && styles.captureButtonDisabled]}
                disabled={isProcessing || settings.targetLanguage === 'auto'}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={styles.captureButtonInner} />
                )}
              </TouchableOpacity>
              
              <View style={styles.placeholder} />
            </View>
          </View>
        </CameraView>
      </View>

      {lastTranslation && (
        <ScrollView style={styles.resultContainer} showsVerticalScrollIndicator={false}>
          <TranslationCard translation={lastTranslation} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#F8F9FA',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#202124',
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: '#5F6368',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  webScrollView: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  webContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 40,
    backgroundColor: '#F8F9FA',
  },
  webTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#202124',
    marginTop: 24,
    marginBottom: 12,
  },
  webText: {
    fontSize: 16,
    color: '#5F6368',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  webLanguageSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginVertical: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  webLanguageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 16,
  },
  webLanguageRow: {
    gap: 16,
  },
  webLanguageItem: {
    gap: 8,
  },
  webLanguageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5F6368',
  },
  webButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  webButtonDisabled: {
    backgroundColor: '#9AA0A6',
  },
  webWarningText: {
    fontSize: 12,
    color: '#EA4335',
    textAlign: 'center',
    marginTop: 8,
  },
  webResultContainer: {
    width: '100%',
    maxWidth: 400,
    marginTop: 24,
  },
  webResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 12,
  },
  webButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  warningBanner: {
    backgroundColor: '#FEF7E0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningBannerText: {
    fontSize: 12,
    color: '#F9AB00',
    textAlign: 'center',
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 20,
    maxWidth: 400,
    width: '90%',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#5F6368',
  },
  settingsContent: {
    padding: 20,
    gap: 20,
  },
  settingsRow: {
    gap: 8,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5F6368',
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
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusFrame: {
    position: 'absolute',
    top: '35%',
    left: '10%',
    right: '10%',
    height: 140,
    borderWidth: 2,
    borderColor: '#4285F4',
    borderRadius: 12,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusFrameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    gap: 8,
  },
  galleryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  placeholder: {
    width: 80,
  },
  processingContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  processingText: {
    fontSize: 16,
    color: '#5F6368',
    marginTop: 12,
  },
  resultContainer: {
    backgroundColor: '#F8F9FA',
    maxHeight: 250,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
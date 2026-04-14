import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Globe, Volume2, Trash2, Info, Wifi, WifiOff, Database } from 'lucide-react-native';
import { useTranslation } from '@/hooks/translation-store';
import LanguageSelector from '@/components/LanguageSelector';

const appVersion: string = require('../../package.json').version;

export default function SettingsScreen() {
  const { settings, updateSettings, clearHistory, isOnline, translationCache } = useTranslation();
  const insets = useSafeAreaInsets();

  const handleClearHistory = () => {
    console.log('Clearing translation history');
    clearHistory();
  };

  const showAbout = () => {
    Alert.alert(
      'About App',
      `Translation App\nVersion ${appVersion}\nA multilingual translation app for text, image, and PDF translation.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Network & Offline Mode</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              {isOnline ? <Wifi size={20} color="#34A853" /> : <WifiOff size={20} color="#EA4335" />}
              <View>
                <Text style={styles.settingLabel}>Network Status</Text>
                <Text style={[styles.settingDescription, { color: isOnline ? '#34A853' : '#EA4335' }]}>
                  {isOnline ? 'Connected' : 'Offline'}
                </Text>
              </View>
            </View>
            <View style={[styles.statusBadge, isOnline ? styles.statusOnline : styles.statusOffline]}>
              <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Database size={20} color="#5F6368" />
              <View>
                <Text style={styles.settingLabel}>Offline Mode</Text>
                <Text style={styles.settingDescription}>
                  Use cached translations only
                </Text>
              </View>
            </View>
            <Switch
              value={settings.offlineMode}
              onValueChange={(value) => updateSettings({ offlineMode: value })}
              trackColor={{ false: '#E8EAED', true: '#4285F4' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Database size={20} color="#5F6368" />
              <View>
                <Text style={styles.settingLabel}>Cached Translations</Text>
                <Text style={styles.settingDescription}>
                  {translationCache} translations saved for offline use
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Languages</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Globe size={20} color="#5F6368" />
              <Text style={styles.settingLabel}>Source Language</Text>
            </View>
            <LanguageSelector
              selectedLanguage={settings.sourceLanguage}
              onLanguageSelect={(code) => updateSettings({ sourceLanguage: code })}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Globe size={20} color="#5F6368" />
              <Text style={styles.settingLabel}>Target Language</Text>
            </View>
            <LanguageSelector
              selectedLanguage={settings.targetLanguage}
              onLanguageSelect={(code) => updateSettings({ targetLanguage: code })}
              excludeAuto
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Speech Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Volume2 size={20} color="#5F6368" />
              <View>
                <Text style={styles.settingLabel}>Auto-play Translation</Text>
                <Text style={styles.settingDescription}>
                  Automatically speak translated text
                </Text>
              </View>
            </View>
            <Switch
              value={settings.autoSpeak}
              onValueChange={(value) => updateSettings({ autoSpeak: value })}
              trackColor={{ false: '#E8EAED', true: '#4285F4' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Volume2 size={20} color="#5F6368" />
              <View>
                <Text style={styles.settingLabel}>Speech Rate</Text>
                <Text style={styles.settingDescription}>
                  Current: {settings.speechRate}x
                </Text>
              </View>
            </View>
            <View style={styles.speechRateButtons}>
              {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                <TouchableOpacity
                  key={rate}
                  style={[
                    styles.rateButton,
                    settings.speechRate === rate && styles.rateButtonActive
                  ]}
                  onPress={() => updateSettings({ speechRate: rate })}
                >
                  <Text style={[
                    styles.rateButtonText,
                    settings.speechRate === rate && styles.rateButtonTextActive
                  ]}>
                    {rate}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Volume2 size={20} color="#5F6368" />
              <View>
                <Text style={styles.settingLabel}>Speech Pitch</Text>
                <Text style={styles.settingDescription}>
                  Current: {settings.ttsSettings.pitch.toFixed(1)}
                </Text>
              </View>
            </View>
            <View style={styles.speechRateButtons}>
              {[0.5, 0.8, 1.0, 1.2, 1.5].map((pitch) => (
                <TouchableOpacity
                  key={pitch}
                  style={[
                    styles.rateButton,
                    settings.ttsSettings.pitch === pitch && styles.rateButtonActive
                  ]}
                  onPress={() => updateSettings({ 
                    ttsSettings: { ...settings.ttsSettings, pitch } 
                  })}
                >
                  <Text style={[
                    styles.rateButtonText,
                    settings.ttsSettings.pitch === pitch && styles.rateButtonTextActive
                  ]}>
                    {pitch}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Volume2 size={20} color="#5F6368" />
              <View>
                <Text style={styles.settingLabel}>Speech Volume</Text>
                <Text style={styles.settingDescription}>
                  Current: {Math.round(settings.ttsSettings.volume * 100)}%
                </Text>
              </View>
            </View>
            <View style={styles.speechRateButtons}>
              {[0.3, 0.5, 0.7, 1.0].map((volume) => (
                <TouchableOpacity
                  key={volume}
                  style={[
                    styles.rateButton,
                    settings.ttsSettings.volume === volume && styles.rateButtonActive
                  ]}
                  onPress={() => updateSettings({ 
                    ttsSettings: { ...settings.ttsSettings, volume } 
                  })}
                >
                  <Text style={[
                    styles.rateButtonText,
                    settings.ttsSettings.volume === volume && styles.rateButtonTextActive
                  ]}>
                    {Math.round(volume * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          
          <TouchableOpacity style={styles.settingItem} onPress={handleClearHistory}>
            <View style={styles.settingInfo}>
              <Trash2 size={20} color="#EA4335" />
              <View>
                <Text style={[styles.settingLabel, { color: '#EA4335' }]}>
                  Clear Translation History
                </Text>
                <Text style={styles.settingDescription}>
                  Delete all saved translations
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color="#9AA0A6" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <TouchableOpacity style={styles.settingItem} onPress={showAbout}>
            <View style={styles.settingInfo}>
              <Info size={20} color="#5F6368" />
              <View>
                <Text style={styles.settingLabel}>About App</Text>
                <Text style={styles.settingDescription}>
                  Version {appVersion} and app information
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color="#9AA0A6" />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Translation App v{appVersion}</Text>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#202124',
    marginLeft: 16,
  },
  settingDescription: {
    fontSize: 14,
    color: '#5F6368',
    marginLeft: 16,
    marginTop: 2,
  },
  speechRateButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  rateButtonActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  rateButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5F6368',
  },
  rateButtonTextActive: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 20,
    textAlign: 'center',
  },
  voiceList: {
    maxHeight: 300,
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
  },
  voiceItemActive: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  voiceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#202124',
  },
  voiceTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  voiceLanguage: {
    fontSize: 14,
    color: '#5F6368',
    marginTop: 2,
  },
  voiceSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285F4',
  },
  modalCloseButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#9AA0A6',
    textAlign: 'center',
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusOnline: {
    backgroundColor: '#E8F5E9',
  },
  statusOffline: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
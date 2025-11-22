import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { ChevronDown, Search, X } from 'lucide-react-native';
import { LANGUAGES, Language } from '@/constants/languages';

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageSelect: (languageCode: string) => void;
  placeholder?: string;
  excludeAuto?: boolean;
}

export default function LanguageSelector({
  selectedLanguage,
  onLanguageSelect,
  placeholder = "Select Language",
  excludeAuto = false,
}: LanguageSelectorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const availableLanguages = excludeAuto 
    ? LANGUAGES.filter(lang => lang.code !== 'auto')
    : LANGUAGES;

  const filteredLanguages = availableLanguages.filter(language =>
    language.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    language.nativeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedLang = LANGUAGES.find(lang => lang.code === selectedLanguage);

  const handleSelect = (language: Language) => {
    onLanguageSelect(language.code);
    setIsVisible(false);
    setSearchQuery('');
  };

  return (
    <>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setIsVisible(true)}
        testID="language-selector"
      >
        <Text style={styles.selectedText} numberOfLines={1}>
          {selectedLang ? selectedLang.name : placeholder}
        </Text>
        <ChevronDown size={20} color="#5F6368" />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <TouchableOpacity
              onPress={() => setIsVisible(false)}
              style={styles.closeButton}
            >
              <X size={24} color="#5F6368" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color="#9AA0A6" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search languages..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filteredLanguages}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.languageItem,
                  item.code === selectedLanguage && styles.selectedItem,
                ]}
                onPress={() => handleSelect(item)}
              >
                <View>
                  <Text style={styles.languageName}>{item.name}</Text>
                  <Text style={styles.nativeName}>{item.nativeName}</Text>
                </View>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8EAED',
    minWidth: 120,
  },
  selectedText: {
    fontSize: 16,
    color: '#202124',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#202124',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#202124',
  },
  languageItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  selectedItem: {
    backgroundColor: '#E8F0FE',
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#202124',
    marginBottom: 2,
  },
  nativeName: {
    fontSize: 14,
    color: '#5F6368',
  },
});
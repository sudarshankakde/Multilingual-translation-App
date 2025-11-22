import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Trash2, Filter } from 'lucide-react-native';
import { useTranslation } from '@/hooks/translation-store';
import TranslationCard from '@/components/TranslationCard';
import { Translation } from '@/types/translation';

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'text' | 'camera' | 'pdf'>('all');
  const { history, clearHistory } = useTranslation();
  const insets = useSafeAreaInsets();

  const filteredHistory = history.filter(translation => {
    const matchesSearch = searchQuery === '' || 
      translation.originalText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      translation.translatedText.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterType === 'all' || translation.type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  const handleClearHistory = () => {
    console.log('Clearing translation history');
    clearHistory();
  };

  const renderFilterButton = (type: typeof filterType, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filterType === type && styles.filterButtonActive
      ]}
      onPress={() => setFilterType(type)}
    >
      <Text style={[
        styles.filterButtonText,
        filterType === type && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderTranslation = ({ item }: { item: Translation }) => (
    <TranslationCard translation={item} />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No translations found</Text>
      <Text style={styles.emptyText}>
        {searchQuery || filterType !== 'all' 
          ? 'Try adjusting your search or filter'
          : 'Start translating to see your history here'
        }
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Translation History</Text>
          {history.length > 0 && (
            <TouchableOpacity onPress={handleClearHistory} style={styles.clearButton}>
              <Trash2 size={20} color="#EA4335" />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.searchContainer}>
          <Search size={20} color="#9AA0A6" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search translations..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.filterContainer}>
          <Filter size={16} color="#5F6368" style={styles.filterIcon} />
          <View style={styles.filterButtons}>
            {renderFilterButton('all', 'All')}
            {renderFilterButton('text', 'Text')}
            {renderFilterButton('camera', 'Camera')}
            {renderFilterButton('pdf', 'PDF')}
          </View>
        </View>
      </View>

      <FlatList
        data={filteredHistory}
        renderItem={renderTranslation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#202124',
  },
  clearButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8EAED',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#202124',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterIcon: {
    marginRight: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  filterButtonActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5F6368',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#5F6368',
    textAlign: 'center',
    lineHeight: 24,
  },
});
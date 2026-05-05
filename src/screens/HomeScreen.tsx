import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../store/playerStore';
import AudioPlayer from '../components/AudioPlayer';
import DocumentCard from '../components/DocumentCard';
import SettingsSheet from '../components/SettingsSheet';
import { Radius, Spacing, useAppTheme } from '../theme';

export default function HomeScreen() {
  const store = usePlayerStore();
  const insets = useSafeAreaInsets();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const colors = useAppTheme();
  const theme = store.settings.theme;

  useEffect(() => {
    store.init();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar 
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.dark} 
        translucent 
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.dark, paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <View style={styles.logoRow}>
            <View style={[styles.logoIcon, { backgroundColor: colors.accentDim }]}>
              <Text style={styles.logoEmoji}>🎧</Text>
            </View>
            <View>
              <Text style={[styles.appName, { color: colors.text }]}>ALD-Reader</Text>
              <Text style={[styles.appSub, { color: colors.white40 }]}>Lecture audio de documents</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.settingsBtn, { backgroundColor: colors.white10 }]}
            onPress={() => setSettingsVisible(true)}
          >
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Language badge */}
        <TouchableOpacity
          style={[styles.langBadge, { backgroundColor: colors.white10 }]}
          onPress={() => setSettingsVisible(true)}
        >
          <Text style={styles.langFlag}>{store.settings.language.flag}</Text>
          <Text style={[styles.langLabel, { color: colors.white60 }]}>{store.settings.language.label}</Text>
          <Text style={[styles.langArrow, { color: colors.white40 }]}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Player */}
        <View style={{ marginBottom: Spacing.xxl }}>
          <AudioPlayer />
        </View>

        {/* Reader View */}
        {store.currentDoc && store.pages.length > 0 && (
          <View style={[styles.readerContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.readerHeader, { borderBottomColor: colors.separator }]}>
              <Text style={[styles.readerTitle, { color: colors.text }]}>Contenu du document</Text>
              <Text style={[styles.readerPage, { color: colors.black40 }]}>
                Page {store.currentPageIndex + 1} / {store.pages.length}
              </Text>
            </View>
            <ReaderView
              text={store.pages[store.currentPageIndex]}
              highlightIndex={store.currentChunkIndex}
              colors={colors}
            />
          </View>
        )}

        {/* Library header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Bibliothèque</Text>
          <Text style={[styles.sectionCount, { color: colors.black40 }]}>
            {store.library.length} document{store.library.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Library list */}
        {store.library.length === 0 ? (
          <EmptyLibrary onAdd={store.pickDocument} colors={colors} />
        ) : (
          <View style={styles.libList}>
            {store.library.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </View>
        )}

        {/* Error */}
        {store.errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {store.errorMessage}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.accent }]} 
        onPress={store.pickDocument} 
        activeOpacity={0.85}
      >
        <Text style={[styles.fabIcon, { color: '#FFF' }]}>+</Text>
      </TouchableOpacity>

      {/* Settings */}
      <SettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </View>
  );
}

function EmptyLibrary({ onAdd, colors }: { onAdd: () => void, colors: any }) {
  return (
    <TouchableOpacity 
      style={[styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.separator }]} 
      onPress={onAdd} 
      activeOpacity={0.8}
    >
      <Text style={styles.emptyEmoji}>📂</Text>
      <Text style={[styles.emptyTitle, { color: colors.black40 }]}>Bibliothèque vide</Text>
      <Text style={[styles.emptyHint, { color: colors.black25 }]}>
        Appuyez pour importer un PDF, EPUB ou TXT
      </Text>
    </TouchableOpacity>
  );
}

function ReaderView({ text, highlightIndex, colors }: { text: string, highlightIndex: number, colors: any }) {
  // Simple chunking logic to match ttsService (must be identical)
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if (current.length + s.length > 500) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  const finalChunks = chunks.length ? chunks : [text];

  return (
    <View style={styles.readerContent}>
      {finalChunks.map((chunk, idx) => (
        <Text
          key={idx}
          style={[
            styles.readerText,
            { color: colors.textDim },
            idx === highlightIndex && [styles.readerTextActive, { color: colors.accent, backgroundColor: colors.accentDim }]
          ]}
        >
          {chunk}{' '}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {},
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 12,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 18 },
  appName: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  appSub: { fontSize: 10 },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Spacing.xl,
    marginBottom: 14,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  langFlag: { fontSize: 14 },
  langLabel: { fontSize: 12, fontWeight: '500' },
  langArrow: { fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  sectionCount: { fontSize: 12 },
  libList: { paddingHorizontal: Spacing.lg, gap: 8 },
  readerContainer: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  readerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  readerTitle: { fontSize: 14, fontWeight: '700' },
  readerPage: { fontSize: 11 },
  readerContent: { flexDirection: 'row', flexWrap: 'wrap' },
  readerText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
  },
  readerTextActive: {
    fontWeight: '600',
  },
  emptyCard: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    padding: 32,
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 32, marginBottom: 10 },
  emptyTitle: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  emptyHint: { fontSize: 11, textAlign: 'center' },
  errorBanner: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: 'rgba(231,76,60,0.1)',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: { color: '#E74C3C', fontSize: 12 },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: { fontSize: 28, lineHeight: 32 },
});

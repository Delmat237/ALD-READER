import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../../src/store/playerStore';
import DocumentCard from '../../src/components/DocumentCard';
import SettingsSheet from '../../src/components/SettingsSheet';
import { Radius, Spacing, useAppTheme } from '../../src/theme';
import { router } from 'expo-router';

export default function LibraryScreen() {
  const store = usePlayerStore();
  const insets = useSafeAreaInsets();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const colors = useAppTheme();
  const theme = store.settings.theme;

  useEffect(() => {
    store.init();
  }, []);

  const hasMiniPlayer = !!store.currentDoc;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar 
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.dark} 
        translucent 
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.dark, borderBottomColor: colors.separator, paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={styles.logoRow}>
            <View style={[styles.logoIcon, { backgroundColor: colors.accentDim, borderColor: colors.accentBorder }]}>
              <Text style={styles.logoEmoji}>🎧</Text>
            </View>
            <View>
              <Text style={[styles.appName, { color: colors.text }]}>ALD-Reader</Text>
              <Text style={[styles.appSub, { color: colors.white40 }]}>Ma bibliothèque</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.langPill, { backgroundColor: colors.white10 }]}
              onPress={() => setSettingsVisible(true)}
            >
              <Text style={styles.langFlag}>{store.settings.language.flag}</Text>
              <Text style={[styles.langCode, { color: colors.white60 }]}>{store.settings.language.code.toUpperCase()}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.white10 }]}
              onPress={() => setSettingsVisible(true)}
            >
              <Text style={styles.iconBtnText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats bar */}
        {store.library.length > 0 && (
          <View style={styles.statsRow}>
            <Text style={[styles.statsText, { color: colors.white40 }]}>
              {store.library.length} document{store.library.length !== 1 ? 's' : ''}
            </Text>
            {store.currentDoc && (
              <Text style={[styles.statsText, { color: colors.white40 }]}>
                En cours · {store.currentDoc.name.slice(0, 20)}{store.currentDoc.name.length > 20 ? '…' : ''}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {store.library.length === 0 ? (
          <EmptyLibrary onAdd={store.pickDocument} colors={colors} />
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.white60 }]}>Documents</Text>
            <View style={styles.libList}>
              {store.library.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Mini Player */}
      {hasMiniPlayer && (
        <TouchableOpacity
          style={[styles.miniPlayer, { backgroundColor: colors.darkCard, borderColor: colors.border }]}
          onPress={() => router.push('/reader')}
          activeOpacity={0.92}
        >
          {/* Accent bar top */}
          <View style={[styles.miniPlayerAccentBar, { backgroundColor: colors.accent }]} />

          <View style={styles.miniPlayerInner}>
            <View style={styles.miniPlayerLeft}>
              <View style={[styles.miniPlayerThumb, { backgroundColor: colors.surface }]}>
                <Text style={{ fontSize: 16 }}>
                  {store.status === 'playing' ? '🔊' : '📄'}
                </Text>
              </View>
              <View style={styles.miniPlayerInfo}>
                <Text style={[styles.miniPlayerTitle, { color: colors.text }]} numberOfLines={1}>
                  {store.currentDoc!.name}
                </Text>
                <Text style={[styles.miniPlayerSub, { color: colors.white40 }]}>
                  {store.status === 'playing'
                    ? `Page ${store.currentPageIndex + 1} · En lecture`
                    : store.status === 'loading'
                    ? 'Chargement…'
                    : store.status === 'paused'
                    ? 'En pause'
                    : 'Prêt'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={store.togglePlayPause}
              style={[styles.miniPlayBtn, { backgroundColor: colors.accent }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.miniPlayIcon, { color: '#FFF' }]}>
                {store.status === 'playing' ? '⏸' : '▶'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Progress line */}
          <View style={[styles.miniProgressTrack, { backgroundColor: colors.white10 }]}>
            <View
              style={[
                styles.miniProgressFill,
                { width: `${Math.round(store.getProgress() * 100)}%` as any, backgroundColor: colors.accent },
              ]}
            />
          </View>
        </TouchableOpacity>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: hasMiniPlayer ? 88 : 24, backgroundColor: colors.accent, shadowColor: colors.accent }]}
        onPress={store.pickDocument}
        activeOpacity={0.85}
      >
        <Text style={[styles.fabIcon, { color: '#FFF' }]}>+</Text>
      </TouchableOpacity>

      <SettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </View>
  );
}

function EmptyLibrary({ onAdd, colors }: { onAdd: () => void, colors: any }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.emptyEmoji}>📂</Text>
      </View>
      <Text style={[styles.emptyTitle, { color: colors.white80 }]}>Bibliothèque vide</Text>
      <Text style={[styles.emptyHint, { color: colors.white40 }]}>
        Importez un PDF, EPUB ou TXT pour commencer
      </Text>
      <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.accent }]} onPress={onAdd} activeOpacity={0.8}>
        <Text style={[styles.emptyBtnText, { color: '#FFF' }]}>+ Importer un document</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 20 },
  appName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  appSub: { fontSize: 11, marginTop: 1 },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  langFlag: { fontSize: 13 },
  langCode: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 16 },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.xl, paddingHorizontal: Spacing.lg },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
  },
  libList: { gap: 8 },

  // Empty state
  emptyWrap: {
    marginTop: 48,
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyEmoji: { fontSize: 30 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 28,
  },
  emptyBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Mini Player
  miniPlayer: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 8,
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  miniPlayerAccentBar: {
    height: 2,
    opacity: 0.6,
  },
  miniPlayerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  miniPlayerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniPlayerThumb: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPlayerInfo: { flex: 1 },
  miniPlayerTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  miniPlayerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  miniPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPlayIcon: { fontSize: 14 },
  miniProgressTrack: {
    height: 2,
  },
  miniProgressFill: {
    height: 2,
    opacity: 0.8,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  fabIcon: { fontSize: 26, lineHeight: 30 },
});

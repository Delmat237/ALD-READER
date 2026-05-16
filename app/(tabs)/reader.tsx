import React, { useEffect, useCallback, memo, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, FlatList, useWindowDimensions,
} from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../../src/store/playerStore';
import AudioPlayer from '../../src/components/AudioPlayer';
import DocumentPreview from '../../src/components/DocumentPreview';
import SettingsSheet from '../../src/components/SettingsSheet';
import { Radius, Spacing, useAppTheme } from '../../src/theme';
import { splitIntoSpeechChunks } from '../../src/utils/text';

// Memoize PageCard for performance
const MemoPageCard = memo(PageCard);

export default function ReaderScreen() {
  const store = usePlayerStore();
  const insets = useSafeAreaInsets();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [contentTab, setContentTab] = useState<'preview' | 'text'>('text');
  const flatListRef = React.useRef<FlatList>(null);
  const colors = useAppTheme();
  const theme = store.settings.theme;
  const { width: screenW } = useWindowDimensions();

  useEffect(() => {
    setContentTab('text');
  }, [store.currentDoc?.id]);

  // Safe scroll to index
  useEffect(() => {
    if (flatListRef.current && store.pages.length > 0) {
      try {
        flatListRef.current.scrollToIndex({
          index: store.currentPageIndex,
          animated: true,
        });
      } catch (err) {
        // Fallback if index not ready yet
        console.warn('FlatList scrollToIndex failed, retrying...', err);
      }
    }
  }, [store.currentPageIndex, store.pages.length]);

  const currentChunkText = useMemo(() => {
    const page = store.pages[store.currentPageIndex];
    if (!page) return null;
    const chunks = splitIntoSpeechChunks(page);
    if (!chunks.length) return null;
    const idx = Math.min(store.currentChunkIndex, chunks.length - 1);
    return chunks[idx] ?? null;
  }, [store.pages, store.currentPageIndex, store.currentChunkIndex]);

  const showContentTabs =
    store.currentDoc?.type === 'pdf' ||
    store.currentDoc?.type === 'txt' ||
    store.previewLoading ||
    store.previewImageUris.length > 0 ||
    store.previewTxtRaw !== null;

  const renderItem = useCallback(({ item, index }: any) => (
    <MemoPageCard
      text={item}
      pageNum={index + 1}
      total={store.pages.length}
      highlightIndex={index === store.currentPageIndex ? store.currentChunkIndex : -1}
      isRTL={store.settings.language.rtl === true}
      colors={colors}
      width={screenW}
      onChunkPress={(chunkIdx: number) => store.jumpToChunk(chunkIdx)}
    />
  ), [store.pages.length, store.currentPageIndex, store.currentChunkIndex, store.settings.language.rtl, colors, screenW]);

  if (!store.currentDoc) {
    return (
      <View style={[styles.root, styles.emptyRoot, { backgroundColor: colors.bg }]}>
        <StatusBar 
          barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} 
          backgroundColor={colors.dark} 
          translucent 
        />
        <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 36 }}>🎧</Text>
        </View>
        <Text style={[styles.emptyTitle, { color: colors.white80 }]}>Aucun document en cours</Text>
        <Text style={[styles.emptyHint, { color: colors.white40 }]}>
          Sélectionnez un document dans la bibliothèque pour démarrer la lecture.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar 
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.dark} 
        translucent 
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.dark, borderBottomColor: colors.separator, paddingTop: insets.top + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {store.currentDoc.name}
        </Text>
        <View style={styles.headerRight}>
          <Text style={[styles.headerPage, { color: colors.white40 }]}>
            {store.currentPageIndex + 1} / {store.pages.length}
          </Text>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.white10 }]}
            onPress={() => setSettingsVisible(true)}
          >
            <Text style={{ fontSize: 16 }}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Audio Player */}
      <View style={styles.playerArea}>
        <AudioPlayer />
      </View>

      <View style={styles.contentArea}>
        {showContentTabs ? (
          <View style={[styles.tabBar, { borderBottomColor: colors.separator }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                contentTab === 'preview' && [
                  styles.tabActive,
                  { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
                ],
              ]}
              onPress={() => setContentTab('preview')}
              accessibilityRole="tab"
              accessibilityState={{ selected: contentTab === 'preview' }}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.white40 },
                  contentTab === 'preview' && { color: colors.accentLight, fontWeight: '600' },
                ]}
              >
                Aperçu
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                contentTab === 'text' && [
                  styles.tabActive,
                  { backgroundColor: colors.accentDim, borderColor: colors.accentBorder },
                ],
              ]}
              onPress={() => setContentTab('text')}
              accessibilityRole="tab"
              accessibilityState={{ selected: contentTab === 'text' }}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.white40 },
                  contentTab === 'text' && { color: colors.accentLight, fontWeight: '600' },
                ]}
              >
                Texte
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showContentTabs && contentTab === 'preview' ? (
          <DocumentPreview
            fill
            showLabel={false}
            imageUri={
              store.previewImageUris.length > 0
                ? store.previewImageUris[
                    Math.min(store.currentPageIndex, store.previewImageUris.length - 1)
                  ] ?? null
                : null
            }
            txtRaw={store.previewTxtRaw}
            pageNum={store.currentPageIndex + 1}
            totalPages={
              store.previewImageUris.length > 0
                ? store.previewImageUris.length
                : store.pages.length
            }
            docType={store.currentDoc.type}
            loading={store.previewLoading}
            currentChunkText={currentChunkText}
            language={store.settings.language}
            colors={colors}
          />
        ) : (
          <FlatList
            ref={flatListRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={store.pages}
            keyExtractor={(_, i) => i.toString()}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(
                e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width
              );
              if (idx >= 0 && idx < store.pages.length && idx !== store.currentPageIndex) {
                store.seekToProgress(idx / (store.pages.length - 1 || 1));
              }
            }}
            initialScrollIndex={
              store.currentPageIndex >= store.pages.length ? 0 : store.currentPageIndex
            }
            getItemLayout={(_, index) => ({
              length: screenW,
              offset: screenW * index,
              index,
            })}
            windowSize={3}
            maxToRenderPerBatch={2}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={true}
            style={styles.pager}
            renderItem={renderItem}
          />
        )}
      </View>

      <SettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </View>
  );
}

function PageCard({
  text,
  pageNum,
  total,
  highlightIndex,
  isRTL,
  colors,
  width,
  onChunkPress
}: {
  text: string;
  pageNum: number;
  total: number;
  highlightIndex: number;
  isRTL: boolean;
  colors: any;
  width: number;
  onChunkPress: (idx: number) => void;
}) {
  const scrollRef = React.useRef<ScrollView>(null);
  const layouts = React.useRef<Record<number, number>>({});

  // Memoize chunks to avoid re-splitting on every render
  const finalChunks = useMemo(() => splitIntoSpeechChunks(text), [text]);

  useEffect(() => {
    const y = layouts.current[highlightIndex];
    if (y !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 60), animated: true });
    }
  }, [highlightIndex]);

  return (
    <View style={[styles.pageCard, { width }]}>
      {/* Page tag */}
      <View style={[styles.pageTag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.pageTagText, { color: colors.white60 }]}>
          Page {pageNum}
          <Text style={[styles.pageTagTotal, { color: colors.white40 }]}> / {total}</Text>
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.pageScroll}
        contentContainerStyle={styles.pageScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {finalChunks.map((chunk, idx) => (
          <TouchableOpacity
            key={idx}
            activeOpacity={0.7}
            onPress={() => onChunkPress(idx)}
            onLayout={(e) => {
              layouts.current[idx] = e.nativeEvent.layout.y;
            }}
          >
            <Text
              style={[
                styles.chunkText,
                { color: colors.white60 },
                idx === highlightIndex && [styles.chunkTextActive, { color: colors.text, backgroundColor: colors.accentDim, borderLeftColor: colors.accent }],
                isRTL && styles.chunkTextRTL,
              ]}
            >
              {chunk}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  emptyRoot: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerPage: {
    fontSize: 11,
    fontWeight: '500',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Player area
  playerArea: {
    paddingVertical: Spacing.lg,
  },

  contentArea: {
    flex: 1,
    minHeight: 0,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: 8,
    borderBottomWidth: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },

  pager: { flex: 1 },

  pageCard: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  pageTag: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
    borderWidth: 1,
  },
  pageTagText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  pageTagTotal: {
  },
  pageScroll: { flex: 1 },
  pageScrollContent: {},
  chunkText: {
    fontSize: 17,
    lineHeight: 28,
    marginBottom: 12,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    letterSpacing: 0.1,
  },
  chunkTextActive: {
    borderLeftWidth: 2,
    paddingLeft: 10,
  },
  chunkTextRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

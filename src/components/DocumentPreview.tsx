import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ImageLoadEvent,
} from 'react-native';
import type { AppLanguage } from '../types';
import { splitIntoSpeechChunks } from '../utils/text';
import {
  getPreviewLineLayout,
  highlightRectsForChunk,
} from '../services/previewHighlightService';
import { Radius, Spacing } from '../theme';

type Props = {
  imageUri: string | null;
  txtRaw: string | null;
  pageNum: number;
  totalPages: number;
  docType: string;
  loading: boolean;
  /** Phrase en cours de lecture (TTS). */
  currentChunkText: string | null;
  language: AppLanguage;
  colors: ReturnType<typeof import('../theme').useAppTheme>;
};

export default function DocumentPreview({
  imageUri,
  txtRaw,
  pageNum,
  totalPages,
  docType,
  loading,
  currentChunkText,
  language,
  colors,
}: Props) {
  const { width } = useWindowDimensions();
  const previewHeight = Math.min(width * 1.35, 420);

  const [layoutLoading, setLayoutLoading] = useState(false);
  const [layoutLines, setLayoutLines] = useState<Awaited<ReturnType<typeof getPreviewLineLayout>>>([]);
  const [sourceSize, setSourceSize] = useState({ w: 0, h: 0 });
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!imageUri) {
      setLayoutLines([]);
      return;
    }
    let cancelled = false;
    setLayoutLoading(true);
    getPreviewLineLayout(imageUri, language)
      .then((lines) => {
        if (!cancelled) setLayoutLines(lines);
      })
      .catch(() => {
        if (!cancelled) setLayoutLines([]);
      })
      .finally(() => {
        if (!cancelled) setLayoutLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUri, language.code]);

  const highlightRects = useMemo(() => {
    if (!currentChunkText?.trim() || !imageUri) return [];
    return highlightRectsForChunk(
      currentChunkText,
      layoutLines,
      sourceSize.w,
      sourceSize.h,
      boxSize.w,
      boxSize.h
    );
  }, [currentChunkText, layoutLines, sourceSize, boxSize, imageUri]);

  const txtChunks = useMemo(
    () => (txtRaw ? splitIntoSpeechChunks(txtRaw) : []),
    [txtRaw]
  );
  const txtHighlightIdx = useMemo(() => {
    if (!txtRaw || !currentChunkText) return -1;
    const norm = (s: string) => s.trim().toLowerCase();
    const target = norm(currentChunkText);
    return txtChunks.findIndex((c) => norm(c) === target || norm(c).includes(target.slice(0, 30)));
  }, [txtRaw, txtChunks, currentChunkText]);

  const onImageLoad = (e: ImageLoadEvent) => {
    const { width: w, height: h } = e.nativeEvent.source;
    if (w && h) setSourceSize({ w, h });
  };

  const onBoxLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w && h) setBoxSize({ w, h });
  };

  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.white40 }]}>APERÇU</Text>
        <Text style={[styles.pageHint, { color: colors.white40 }]}>
          {docType === 'pdf' && totalPages > 0
            ? `Page ${pageNum} / ${totalPages}`
            : docType === 'txt'
              ? 'Fichier original'
              : 'Document'}
        </Text>
      </View>

      {loading ? (
        <View style={[styles.placeholder, { height: previewHeight }]}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.hint, { color: colors.white40 }]}>Génération de l’aperçu…</Text>
        </View>
      ) : imageUri ? (
        <>
          <View
            style={[styles.imageFrame, { height: previewHeight, backgroundColor: colors.bg }]}
            onLayout={onBoxLayout}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              onLoad={onImageLoad}
              accessibilityLabel={`Aperçu page ${pageNum}`}
            />
            {highlightRects.map((r, i) => (
              <View
                key={i}
                pointerEvents="none"
                style={[
                  styles.highlightBox,
                  {
                    left: r.left,
                    top: r.top,
                    width: r.width,
                    height: r.height,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
            ))}
            {layoutLoading && (
              <View style={styles.layoutLoadingBadge}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            )}
          </View>
          {currentChunkText ? (
            <View style={[styles.nowReading, { backgroundColor: colors.accentDim, borderColor: colors.accentBorder }]}>
              <Text style={[styles.nowReadingLabel, { color: colors.accentLight }]}>En lecture</Text>
              <Text style={[styles.nowReadingText, { color: colors.text }]} numberOfLines={4}>
                {currentChunkText}
              </Text>
            </View>
          ) : null}
        </>
      ) : txtRaw !== null ? (
        <ScrollView
          style={[styles.txtScroll, { maxHeight: previewHeight }]}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          {txtChunks.map((chunk, idx) => (
            <Text
              key={idx}
              style={[
                styles.txtChunk,
                { color: colors.white60 },
                idx === txtHighlightIdx && {
                  color: colors.text,
                  backgroundColor: colors.accentDim,
                  borderLeftColor: colors.accent,
                },
              ]}
            >
              {chunk}
            </Text>
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.placeholder, { height: 120 }]}>
          <Text style={[styles.hint, { color: colors.white40 }]}>
            {docType === 'epub'
              ? 'Aperçu visuel non disponible pour les EPUB.'
              : 'Aperçu non disponible pour ce format.'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: Spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  pageHint: {
    fontSize: 10,
    fontWeight: '500',
  },
  imageFrame: {
    width: '100%',
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  highlightBox: {
    position: 'absolute',
    opacity: 0.45,
    borderRadius: 3,
  },
  layoutLoadingBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  nowReading: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  nowReadingLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  nowReadingText: {
    fontSize: 13,
    lineHeight: 20,
  },
  txtScroll: {
    borderRadius: Radius.md,
  },
  txtChunk: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
});

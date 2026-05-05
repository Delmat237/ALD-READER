import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { DocuVoiceDocument } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { typeColor } from '../services/documentService';
import { Radius, Spacing, useAppTheme } from '../theme';

interface Props {
  doc: DocuVoiceDocument;
}

const TYPE_EMOJI: Record<string, string> = {
  pdf: '📄',
  epub: '📗',
  txt: '📝',
  unknown: '📁',
};

export default function DocumentCard({ doc }: Props) {
  const store = usePlayerStore();
  const colors = useAppTheme();
  const isActive = store.currentDoc?.id === doc.id;
  const isPlaying = isActive && store.status === 'playing';
  const progressPct = Math.round(doc.readingProgress * 100);

  const handleLongPress = () => {
    Alert.alert(
      'Supprimer',
      `Supprimer "${doc.name}" de la bibliothèque ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => store.removeDocument(doc.id),
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={() => store.openDocument(doc)}
      onLongPress={handleLongPress}
      activeOpacity={0.82}
    >
      <View style={[
        styles.card, 
        { backgroundColor: colors.cardBg, borderColor: colors.border },
        isActive && { borderColor: colors.accentBorder, backgroundColor: colors.surface }
      ]}>
        {/* Type badge */}
        <View style={[styles.badge, { backgroundColor: typeColor(doc.type) + '22' }]}>
          <Text style={styles.badgeEmoji}>{TYPE_EMOJI[doc.type] ?? '📁'}</Text>
          <Text style={[styles.badgeLabel, { color: typeColor(doc.type) }]}>
            {doc.type.toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{doc.name}</Text>
          <View style={styles.metaRow}>
            {doc.totalPages > 0 ? (
              <Text style={[styles.metaText, { color: colors.white40 }]}>{doc.totalPages} pages</Text>
            ) : (
              <Text style={[styles.metaText, { color: colors.white40 }]}>Appuyer pour charger</Text>
            )}
            {doc.readingProgress > 0 && (
              <>
                <View style={[styles.metaDot, { backgroundColor: colors.white20 }]} />
                <Text style={[styles.metaText, { color: colors.accentLight }]}>
                  {progressPct}%
                </Text>
              </>
            )}
          </View>

          {/* Progress bar */}
          {doc.readingProgress > 0 && (
            <View style={[styles.progressTrack, { backgroundColor: colors.white10 }]}>
              <View
                style={[styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: colors.accent }]}
              />
            </View>
          )}
        </View>

        {/* Right indicator */}
        <View style={styles.right}>
          {store.status === 'loading' && isActive ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : isPlaying ? (
            <View style={[styles.playingPill, { backgroundColor: colors.accentDim, borderColor: colors.accentBorder }]}>
              <Text style={[styles.playingDot, { color: colors.accent }]}>●</Text>
              <Text style={[styles.playingLabel, { color: colors.accent }]}>Live</Text>
            </View>
          ) : isActive ? (
            <View style={[styles.playingPill, styles.pausedPill, { backgroundColor: colors.white10, borderColor: colors.border }]}>
              <Text style={[styles.pausedLabel, { color: colors.white40 }]}>⏸</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  badge: {
    width: 48,
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  badgeEmoji: { fontSize: 18 },
  badgeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  info: { flex: 1 },
  name: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  metaText: { fontSize: 11 },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  progressTrack: {
    height: 2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    borderRadius: 2,
  },

  right: { alignItems: 'center', minWidth: 40 },
  playingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  pausedPill: {
  },
  playingDot: { fontSize: 7 },
  playingLabel: { fontSize: 10, fontWeight: '700' },
  pausedLabel: { fontSize: 12 },
});

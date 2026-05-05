import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import { Radius, Spacing, useAppTheme } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const TRACK_H_MARGIN = (Spacing.lg + Spacing.md) * 2; // padding from AudioPlayer container + player area
const BAR_W = SCREEN_W - TRACK_H_MARGIN - 32;

// Wave bars heights (varied for natural look)
const BAR_TARGETS = [14, 20, 16, 22, 12];

export default function AudioPlayer() {
  const store = usePlayerStore();
  const colors = useAppTheme();
  const doc = store.currentDoc;

  // dragRatio: position visuelle pendant le glissement (null = pas de glissement)
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const progress = dragRatio !== null ? dragRatio : store.getProgress();

  // One Animated.Value per bar (animate height for proper bottom-aligned look)
  const barAnims = useRef(BAR_TARGETS.map(() => new Animated.Value(4))).current;

  useEffect(() => {
    if (store.status === 'playing') {
      const animations = barAnims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: BAR_TARGETS[i],
              duration: 280 + i * 60,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 4,
              duration: 280 + i * 60,
              useNativeDriver: false,
            }),
          ])
        )
      );
      const group = Animated.parallel(animations);
      group.start();
      return () => {
        group.stop();
        barAnims.forEach((a) => a.setValue(4));
      };
    } else {
      barAnims.forEach((a) => a.setValue(4));
    }
  }, [store.status]);

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => store.tickSecond(), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    // Mise à jour visuelle en temps réel pendant le glissement
    onPanResponderGrant: (e) => {
      setDragRatio(Math.max(0, Math.min(1, e.nativeEvent.locationX / BAR_W)));
    },
    onPanResponderMove: (e) => {
      setDragRatio(Math.max(0, Math.min(1, e.nativeEvent.locationX / BAR_W)));
    },
    // Seek TTS uniquement à la fin du glissement (un seul appel)
    onPanResponderRelease: (e) => {
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / BAR_W));
      setDragRatio(null);
      store.seekToProgress(ratio);
    },
    onPanResponderTerminate: () => setDragRatio(null),
  });

  if (!doc) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.darkCard, borderColor: colors.border }]}>
        <Text style={styles.emptyIcon}>🎧</Text>
        <Text style={[styles.emptyText, { color: colors.white40 }]}>
          Sélectionnez un document pour commencer
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.darkCard, borderColor: colors.border }]}>
      {/* Top row: title + wave indicator + page */}
      <View style={styles.topRow}>
        <View style={styles.titleArea}>
          {store.status === 'playing' && (
            <View style={styles.waveContainer}>
              {barAnims.map((anim, i) => (
                <View key={i} style={styles.waveBarWrap}>
                  <Animated.View
                    style={[styles.waveBar, { height: anim, backgroundColor: colors.accent }]}
                  />
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.docName, { color: colors.text }]} numberOfLines={1}>{doc.name}</Text>
        </View>
        <View style={[styles.pageChip, { backgroundColor: colors.white10 }]}>
          <Text style={[styles.pageChipText, { color: colors.white40 }]}>
            {store.currentPageIndex + 1}/{store.pages.length || '?'}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack} {...panResponder.panHandlers}>
        <View style={[styles.progressBg, { backgroundColor: colors.white10 }]}>
          <View style={[styles.progressFill, { width: BAR_W * progress, backgroundColor: colors.accent }]}>
            <View style={[styles.progressThumb, { backgroundColor: colors.white, shadowColor: colors.accent }]} />
          </View>
        </View>
      </View>

      {/* Time + rate row */}
      <View style={styles.metaRow}>
        <Text style={[styles.timeText, { color: colors.white40 }]}>{formatTime(store.elapsedSeconds)}</Text>
        <View style={[styles.rateChip, { backgroundColor: colors.accentDim }]}>
          <Text style={[styles.rateText, { color: colors.accentLight }]}>{store.settings.speechRate.toFixed(1)}×</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <CtrlBtn icon="⏮" label="Page −" onPress={store.skipBackward} colors={colors} />
        <CtrlBtn icon="⏪" label="Phrase −" onPress={store.skipSentenceBackward} colors={colors} />
        <PlayBtn status={store.status} onPress={store.togglePlayPause} colors={colors} />
        <CtrlBtn icon="⏩" label="Phrase +" onPress={store.skipSentenceForward} colors={colors} />
        <CtrlBtn icon="⏭" label="Page +" onPress={store.skipForward} colors={colors} />
      </View>
    </View>
  );
}

function PlayBtn({ status, onPress, colors }: { status: string; onPress: () => void, colors: any }) {
  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';
  return (
    <TouchableOpacity 
      style={[styles.playBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]} 
      onPress={onPress} 
      activeOpacity={0.8}
    >
      {isLoading ? (
        <Text style={[styles.playIcon, { color: '#FFF' }]}>⏳</Text>
      ) : (
        <Text style={[styles.playIcon, { fontSize: isPlaying ? 18 : 16, color: '#FFF' }]}>
          {isPlaying ? '⏸' : '▶'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function CtrlBtn({ icon, onPress, colors }: { icon: string; label: string; onPress: () => void, colors: any }) {
  return (
    <TouchableOpacity 
      style={[styles.ctrlBtn, { backgroundColor: colors.white10 }]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <Text style={[styles.ctrlIcon, { color: colors.white60 }]}>{icon}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    borderWidth: 1,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    marginHorizontal: Spacing.lg,
    borderWidth: 1,
  },
  emptyIcon: { fontSize: 18 },
  emptyText: { fontSize: 12, flex: 1 },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  titleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 22,
  },
  waveBarWrap: {
    width: 3,
    height: 22,
    justifyContent: 'flex-end',
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  docName: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  pageChip: {
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pageChipText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Progress
  progressTrack: {
    height: 28,
    justifyContent: 'center',
    marginBottom: 2,
  },
  progressBg: {
    height: 3,
    borderRadius: 3,
    overflow: 'visible',
  },
  progressFill: {
    height: 3,
    borderRadius: 3,
  },
  progressThumb: {
    position: 'absolute',
    right: -6,
    top: -4,
    width: 11,
    height: 11,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },

  // Meta
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeText: { fontSize: 10 },
  rateChip: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rateText: { fontSize: 10, fontWeight: '600' },

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  playIcon: { fontSize: 18 },
  ctrlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlIcon: { fontSize: 15 },
});

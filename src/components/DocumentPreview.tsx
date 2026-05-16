import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Radius, Spacing } from '../theme';

type Props = {
  imageUri: string | null;
  txtRaw: string | null;
  pageNum: number;
  totalPages: number;
  docType: string;
  loading: boolean;
  colors: ReturnType<typeof import('../theme').useAppTheme>;
};

export default function DocumentPreview({
  imageUri,
  txtRaw,
  pageNum,
  totalPages,
  docType,
  loading,
  colors,
}: Props) {
  const { width } = useWindowDimensions();
  const previewHeight = Math.min(width * 1.35, 420);

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
        <View style={[styles.imageFrame, { height: previewHeight, backgroundColor: colors.bg }]}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={`Aperçu page ${pageNum}`}
          />
        </View>
      ) : txtRaw !== null ? (
        <ScrollView
          style={[styles.txtScroll, { maxHeight: previewHeight }]}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          <Text style={[styles.txtRaw, { color: colors.text }]} selectable>
            {txtRaw}
          </Text>
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
  },
  image: {
    width: '100%',
    height: '100%',
  },
  txtScroll: {
    borderRadius: Radius.md,
  },
  txtRaw: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
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

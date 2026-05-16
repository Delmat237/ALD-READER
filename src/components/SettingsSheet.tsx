import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Pressable, TextInput,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { LANGUAGES } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { AUTO_VOICE_ID, formatVoiceLabel, getVoicesForLocale } from '../services/voiceService';
import type { Voice } from 'expo-speech';
import { Radius, Spacing, useAppTheme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsSheet({ visible, onClose }: Props) {
  const store = usePlayerStore();
  const { settings } = store;
  const colors = useAppTheme();
  const [mistralDraft, setMistralDraft] = useState(settings.mistralApiKey ?? '');
  const [googleDraft, setGoogleDraft] = useState(settings.googleApiKey ?? '');
  const [deviceVoices, setDeviceVoices] = useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setMistralDraft(settings.mistralApiKey ?? '');
      setGoogleDraft(settings.googleApiKey ?? '');
    }
  }, [visible, settings.mistralApiKey, settings.googleApiKey]);

  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setVoicesLoading(true);
    getVoicesForLocale(settings.language.ttsLocale)
      .then((list) => {
        if (!cancelled) setDeviceVoices(list);
      })
      .catch(() => {
        if (!cancelled) setDeviceVoices([]);
      })
      .finally(() => {
        if (!cancelled) setVoicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, settings.language.ttsLocale]);

  const selectedVoiceId = settings.selectedVoiceId ?? AUTO_VOICE_ID;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.darkCard, borderColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.white20 }]} />

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]}>Paramètres</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.white10 }]}>
              <Text style={[styles.closeBtnText, { color: colors.white60 }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Theme */}
          <SectionLabel icon="🌓" label="Apparence" colors={colors} />
          <View style={styles.themeRow}>
            {(['light', 'dark'] as const).map((t) => {
              const active = settings.theme === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.themeBtn,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    active && { backgroundColor: colors.accentDim, borderColor: colors.accentBorder }
                  ]}
                  onPress={() => store.setTheme(t)}
                >
                  <Text style={[styles.themeLabel, { color: colors.white60 }, active && { color: colors.accentLight }]}>
                    {t === 'light' ? 'Clair' : 'Sombre'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Language */}
          <SectionLabel icon="🌐" label="Langue de lecture" colors={colors} />
          <View style={styles.langGrid}>
            {LANGUAGES.map((lang) => {
              const active = settings.language.code === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langBtn,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    active && { backgroundColor: colors.accentDim, borderColor: colors.accentBorder }
                  ]}
                  onPress={() => store.setLanguage(lang)}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text style={[styles.langLabel, { color: colors.white60 }, active && { color: colors.accentLight }]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Voix système */}
          <SectionLabel icon="🎤" label="Voix de lecture" colors={colors} />
          <Text style={[styles.voiceHint, { color: colors.white40 }]}>
            Voix installées sur cet appareil pour {settings.language.label}
          </Text>
          {voicesLoading ? (
            <Text style={[styles.voiceHint, { color: colors.white40 }]}>Chargement des voix…</Text>
          ) : (
            <ScrollView
              style={styles.voiceListScroll}
              contentContainerStyle={styles.voiceList}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <TouchableOpacity
                style={[
                  styles.voiceListItem,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  selectedVoiceId === AUTO_VOICE_ID && {
                    backgroundColor: colors.accentDim,
                    borderColor: colors.accentBorder,
                  },
                ]}
                onPress={() => store.setSelectedVoiceId(AUTO_VOICE_ID)}
              >
                <Text
                  style={[
                    styles.voiceListLabel,
                    { color: colors.white60 },
                    selectedVoiceId === AUTO_VOICE_ID && { color: colors.accentLight },
                  ]}
                >
                  Automatique (système)
                </Text>
              </TouchableOpacity>
              {deviceVoices.length === 0 ? (
                <Text style={[styles.voiceHint, { color: colors.white40 }]}>
                  Aucune voix trouvée pour cette langue. Installez des voix dans les réglages Android/iOS.
                </Text>
              ) : (
                deviceVoices.map((voice) => {
                  const active = selectedVoiceId === voice.identifier;
                  return (
                    <TouchableOpacity
                      key={voice.identifier}
                      style={[
                        styles.voiceListItem,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        active && {
                          backgroundColor: colors.accentDim,
                          borderColor: colors.accentBorder,
                        },
                      ]}
                      onPress={() => store.setSelectedVoiceId(voice.identifier)}
                    >
                      <Text
                        style={[
                          styles.voiceListLabel,
                          { color: colors.white60 },
                          active && { color: colors.accentLight },
                        ]}
                        numberOfLines={2}
                      >
                        {formatVoiceLabel(voice)}
                      </Text>
                      <Text style={[styles.voiceListSub, { color: colors.white40 }]}>
                        {voice.language}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* OCR cloud */}
          <SectionLabel icon="☁️" label="OCR en ligne (optionnel)" colors={colors} />
          <Text style={[styles.apiHint, { color: colors.white40 }]}>
            Avec Internet : Mistral puis Google AI. Sinon OCR local (ML Kit).
          </Text>
          <Text style={[styles.apiFieldLabel, { color: colors.white60 }]}>Clé Mistral</Text>
          <TextInput
            style={[styles.apiInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={mistralDraft}
            onChangeText={setMistralDraft}
            onBlur={() => store.setMistralApiKey(mistralDraft)}
            placeholder="sk-…"
            placeholderTextColor={colors.white20}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={[styles.apiFieldLabel, { color: colors.white60 }]}>Clé Google AI (Gemini)</Text>
          <TextInput
            style={[styles.apiInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={googleDraft}
            onChangeText={setGoogleDraft}
            onBlur={() => store.setGoogleApiKey(googleDraft)}
            placeholder="AIza…"
            placeholderTextColor={colors.white20}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          {/* Speed */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <SectionLabel icon="⚡" label="Vitesse" colors={colors} />
              <View style={[styles.valueBadge, { backgroundColor: colors.accentDim, borderColor: colors.accentBorder }]}>
                <Text style={[styles.valueBadgeText, { color: colors.accentLight }]}>{settings.speechRate.toFixed(2)}×</Text>
              </View>
            </View>
            <Slider
              minimumValue={0.25}
              maximumValue={2.0}
              step={0.25}
              value={settings.speechRate}
              onValueChange={store.setSpeechRate}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.white10}
              thumbTintColor={colors.accent}
              style={styles.slider}
            />
            <View style={styles.sliderEnds}>
              <Text style={[styles.sliderEnd, { color: colors.white20 }]}>Lent  0.25×</Text>
              <Text style={[styles.sliderEnd, { color: colors.white20 }]}>2.0×  Rapide</Text>
            </View>
          </View>

          {/* Pitch */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <SectionLabel icon="🎵" label="Tonalité" colors={colors} />
              <View style={[styles.valueBadge, { backgroundColor: colors.accentDim, borderColor: colors.accentBorder }]}>
                <Text style={[styles.valueBadgeText, { color: colors.accentLight }]}>{settings.pitch.toFixed(2)}</Text>
              </View>
            </View>
            <Slider
              minimumValue={0.5}
              maximumValue={2.0}
              step={0.25}
              value={settings.pitch}
              onValueChange={store.setPitch}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.white10}
              thumbTintColor={colors.accent}
              style={styles.slider}
            />
            <View style={styles.sliderEnds}>
              <Text style={[styles.sliderEnd, { color: colors.white20 }]}>Grave</Text>
              <Text style={[styles.sliderEnd, { color: colors.white20 }]}>Aigu</Text>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function SectionLabel({ icon, label, colors }: { icon: string; label: string, colors: any }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.icon}>{icon}</Text>
      <Text style={[sectionStyles.label, { color: colors.white40 }]}>{label}</Text>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 6 },
  icon: { fontSize: 13 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    maxHeight: '88%',
    borderTopWidth: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 13, fontWeight: '600' },

  themeRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.xl },
  themeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  themeLabel: { fontSize: 13, fontWeight: '600' },

  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.xl,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  langFlag: { fontSize: 15 },
  langLabel: { fontSize: 12, fontWeight: '500' },

  voiceHint: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  voiceListScroll: {
    maxHeight: 220,
    marginBottom: Spacing.xl,
  },
  voiceList: {
    gap: 6,
    paddingBottom: 4,
  },
  voiceListItem: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  voiceListLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  voiceListSub: {
    fontSize: 10,
    marginTop: 2,
  },

  sliderSection: { marginBottom: Spacing.md },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  valueBadgeText: { fontSize: 12, fontWeight: '700' },
  slider: { marginHorizontal: -4, marginVertical: 4 },
  sliderEnds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sliderEnd: { fontSize: 10 },

  apiHint: { fontSize: 11, lineHeight: 16, marginBottom: 10 },
  apiFieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, marginTop: 4 },
  apiInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 8,
  },
});

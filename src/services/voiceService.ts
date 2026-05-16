import * as Speech from 'expo-speech';
import type { Voice } from 'expo-speech';

/** Laisser expo-speech choisir la voix par défaut pour la langue. */
export const AUTO_VOICE_ID = '';

export function formatVoiceLabel(voice: Voice): string {
  const enhanced = voice.quality === 'Enhanced' ? ' · HD' : '';
  return `${voice.name}${enhanced}`;
}

function sortVoices(voices: Voice[]): Voice[] {
  return [...voices].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

/**
 * Voix installées sur l’appareil compatibles avec la locale TTS choisie.
 */
export async function getVoicesForLocale(ttsLocale: string): Promise<Voice[]> {
  const all = await Speech.getAvailableVoicesAsync();
  if (!all.length) return [];

  const localeLower = ttsLocale.toLowerCase().replace('_', '-');
  const langCode = localeLower.slice(0, 2);

  const exact = all.filter((v) => v.language.toLowerCase().replace('_', '-') === localeLower);
  if (exact.length) return sortVoices(exact);

  const byLang = all.filter((v) => {
    const vLang = v.language.toLowerCase().replace('_', '-');
    return vLang === langCode || vLang.startsWith(`${langCode}-`);
  });

  return sortVoices(byLang);
}

export async function getAllDeviceVoices(): Promise<Voice[]> {
  const all = await Speech.getAvailableVoicesAsync();
  return sortVoices(all);
}

import Constants from 'expo-constants';
import type { PlayerSettings } from '../types';

export type ResolvedApiKeys = {
  mistral: string | null;
  google: string | null;
};

function trimKey(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Clés build (EAS / app.config extra) + clés saisies dans les paramètres. */
export function resolveApiKeys(settings: PlayerSettings): ResolvedApiKeys {
  const extra = Constants.expoConfig?.extra ?? {};
  return {
    mistral:
      trimKey(settings.mistralApiKey) ??
      trimKey(extra.mistralApiKey) ??
      trimKey(process.env.EXPO_PUBLIC_MISTRAL_API_KEY),
    google:
      trimKey(settings.googleApiKey) ??
      trimKey(extra.googleApiKey) ??
      trimKey(process.env.EXPO_PUBLIC_GOOGLE_API_KEY),
  };
}

export function hasCloudOcrKeys(keys: ResolvedApiKeys): boolean {
  return !!(keys.mistral || keys.google);
}

export type DocumentType = 'pdf' | 'epub' | 'txt' | 'unknown';

export interface DocuVoiceDocument {
  id: string;
  name: string;
  uri: string;
  type: DocumentType;
  totalPages: number;
  currentPage: number;
  readingProgress: number; // 0–1
  addedAt: string; // ISO string
  elapsedSeconds: number;
}

export interface AppLanguage {
  code: string;
  label: string;
  flag: string;
  ttsLocale: string;
  rtl?: boolean;
}

export const LANGUAGES: AppLanguage[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷', ttsLocale: 'fr-FR' },
  { code: 'en', label: 'English', flag: '🇬🇧', ttsLocale: 'en-US' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', ttsLocale: 'de-DE' },
  { code: 'es', label: 'Español', flag: '🇪🇸', ttsLocale: 'es-ES' },
  { code: 'pt', label: 'Português', flag: '🇧🇷', ttsLocale: 'pt-BR' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', ttsLocale: 'ar-SA', rtl: true },
  { code: 'zh', label: '中文', flag: '🇨🇳', ttsLocale: 'zh-CN' },
  { code: 'ja', label: '日本語', flag: '🇯🇵', ttsLocale: 'ja-JP' },
  { code: 'ko', label: '한국어', flag: '🇰🇷', ttsLocale: 'ko-KR' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹', ttsLocale: 'it-IT' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺', ttsLocale: 'ru-RU' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳', ttsLocale: 'hi-IN' },
];

export type VoiceGender = 'female' | 'male' | 'neutral';

export interface PlayerSettings {
  language: AppLanguage;
  voiceGender: VoiceGender;
  speechRate: number;  // 0.25–2.0
  pitch: number;       // 0.5–2.0
  volume: number;      // 0.0–1.0
  theme: 'light' | 'dark';
  /** Clé API Mistral (optionnel, prioritaire pour l’OCR cloud). */
  mistralApiKey?: string;
  /** Clé API Google AI / Gemini (optionnel, repli OCR cloud). */
  googleApiKey?: string;
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  language: LANGUAGES[0],
  voiceGender: 'female',
  speechRate: 0.9,
  pitch: 1.0,
  volume: 1.0,
  theme: 'dark',
  mistralApiKey: '',
  googleApiKey: '',
};

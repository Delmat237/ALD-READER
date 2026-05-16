import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DocuVoiceDocument, PlayerSettings, DEFAULT_SETTINGS, AppLanguage } from '../types';
import { getVoicesForLocale } from '../services/voiceService';
import { clearPreviewLayoutCache } from '../services/previewHighlightService';
import { ttsService } from '../services/ttsService';
import { extractText, typeFromExtension } from '../services/documentService';
import {
  loadDocumentPreview,
  clearDocumentPreviewCache,
} from '../services/documentPreviewService';
import * as DocumentPicker from 'expo-document-picker';
import { v4 as uuidv4 } from 'uuid';

const LIBRARY_KEY = '@docuvoice_library';
const SETTINGS_KEY = '@docuvoice_settings';
/** Incrémenter pour invalider les caches texte après changement d’extraction. */
const CONTENT_CACHE_VERSION = 3;

function contentCacheKey(docId: string): string {
  return `@docuvoice_content_v${CONTENT_CACHE_VERSION}_${docId}`;
}

function isCachedExtractionFailure(pages: string[]): boolean {
  if (!pages.length) return true;
  const joined = pages.join(' ');
  return (
    joined.includes("Ce PDF n'a pas pu être lu") ||
    joined.includes('No content provider') ||
    joined.includes('Impossible de lire ce PDF') ||
    joined.includes('Impossible de convertir le PDF')
  );
}

async function clearAllContentCaches(
  library: DocuVoiceDocument[]
): Promise<void> {
  await Promise.all(
    library.map((d) => AsyncStorage.removeItem(contentCacheKey(d.id)))
  );
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

// Public interface — no private helpers exposed
interface PlayerStore {
  library: DocuVoiceDocument[];
  currentDoc: DocuVoiceDocument | null;
  pages: string[];
  /** URIs des images d’aperçu (PDF), une par page physique. */
  previewImageUris: string[];
  /** Contenu brut TXT pour aperçu sans extraction. */
  previewTxtRaw: string | null;
  previewLoading: boolean;
  currentPageIndex: number;
  currentChunkIndex: number;
  status: PlayerStatus;
  errorMessage: string | null;
  elapsedSeconds: number;
  settings: PlayerSettings;

  init: () => Promise<void>;
  pickDocument: () => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  openDocument: (doc: DocuVoiceDocument) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  stop: () => Promise<void>;
  skipForward: () => Promise<void>;
  skipBackward: () => Promise<void>;
  skipSentenceForward: () => Promise<void>;
  skipSentenceBackward: () => Promise<void>;
  seekToProgress: (ratio: number) => Promise<void>;
  tickSecond: () => void;
  jumpToChunk: (chunkIndex: number) => Promise<void>;
  getProgress: () => number;

  setLanguage: (lang: AppLanguage) => Promise<void>;
  setSelectedVoiceId: (voiceId: string) => Promise<void>;
  setSpeechRate: (rate: number) => Promise<void>;
  setPitch: (pitch: number) => Promise<void>;
  setTheme: (theme: 'light' | 'dark') => Promise<void>;
  setMistralApiKey: (key: string) => Promise<void>;
  setGoogleApiKey: (key: string) => Promise<void>;
}

export const usePlayerStore = create<PlayerStore>((set, get) => {
  // ─── Private closures — not part of the public type ───────────────────────

  const speakCurrent = async () => {
    const { pages, currentPageIndex, settings } = get();
    if (!pages.length || currentPageIndex >= pages.length) return;
    set({ status: 'playing' });
    await ttsService.speak(
      pages[currentPageIndex],
      {
        language: settings.language,
        rate: settings.speechRate,
        pitch: settings.pitch,
        volume: settings.volume,
        voiceId: settings.selectedVoiceId ?? '',
        onChunkStart: (idx) => set({ currentChunkIndex: idx }),
        onDone: () => {
          const { pages, currentPageIndex } = get();
          if (currentPageIndex < pages.length - 1) {
            set((s) => ({ currentPageIndex: s.currentPageIndex + 1, currentChunkIndex: 0 }));
            speakCurrent();
            saveProgress();
          } else {
            set({ status: 'idle', currentChunkIndex: 0 });
            saveProgress();
          }
        },
        onError: (err) => set({ status: 'error', errorMessage: err }),
      },
      get().currentChunkIndex
    );
  };

  const saveProgress = async () => {
    const { currentDoc, pages, currentPageIndex, elapsedSeconds, library } = get();
    if (!currentDoc || !pages.length) return;
    const progress = currentPageIndex / pages.length;
    const updated: DocuVoiceDocument = {
      ...currentDoc,
      readingProgress: progress,
      currentPage: currentPageIndex + 1,
      totalPages: pages.length,
      elapsedSeconds,
    };
    set({ currentDoc: updated });
    const updatedLib = library.map((d) => (d.id === updated.id ? updated : d));
    set({ library: updatedLib });
    await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(updatedLib));
  };

  // ─── Public store ──────────────────────────────────────────────────────────

  return {
    library: [],
    currentDoc: null,
    pages: [],
    previewImageUris: [],
    previewTxtRaw: null,
    previewLoading: false,
    currentPageIndex: 0,
    currentChunkIndex: 0,
    status: 'idle',
    errorMessage: null,
    elapsedSeconds: 0,
    settings: DEFAULT_SETTINGS,

    init: async () => {
      try {
        const [libRaw, settingsRaw] = await Promise.all([
          AsyncStorage.getItem(LIBRARY_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
        ]);
        const library = libRaw ? JSON.parse(libRaw) : [];
        const parsed = settingsRaw ? JSON.parse(settingsRaw) : {};
        const settings: PlayerSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          language: parsed.language
            ? { ...DEFAULT_SETTINGS.language, ...parsed.language }
            : DEFAULT_SETTINGS.language,
          selectedVoiceId:
            typeof parsed.selectedVoiceId === 'string'
              ? parsed.selectedVoiceId
              : '',
        };
        set({ library, settings });
      } catch (err) {
        console.error('Init error (AsyncStorage):', err);
        set({ errorMessage: 'Impossible de charger la bibliothèque.' });
      }
    },

    pickDocument: async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'application/epub+zip', 'text/plain'],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.length) return;

        const asset = result.assets[0];
        const doc: DocuVoiceDocument = {
          id: uuidv4(),
          name: asset.name.replace(/\.[^/.]+$/, ''),
          uri: asset.uri,
          type: typeFromExtension(asset.name),
          totalPages: 0,
          currentPage: 0,
          readingProgress: 0,
          addedAt: new Date().toISOString(),
          elapsedSeconds: 0,
        };
        const library = [doc, ...get().library];
        set({ library });
        await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
      } catch (err: any) {
        set({ errorMessage: err?.message ?? 'Erreur lors de la sélection' });
      }
    },

    removeDocument: async (id: string) => {
      const { currentDoc, library } = get();
      if (currentDoc?.id === id) {
        await get().stop();
        set({
          currentDoc: null,
          pages: [],
          previewImageUris: [],
          previewTxtRaw: null,
          previewLoading: false,
          currentPageIndex: 0,
        });
      }
      await clearDocumentPreviewCache(id);
      clearPreviewLayoutCache();
      const updated = library.filter((d) => d.id !== id);
      set({ library: updated });
      await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(updated));
      // Nettoyer le cache du texte
      await AsyncStorage.removeItem(contentCacheKey(id));
    },

    openDocument: async (doc: DocuVoiceDocument) => {
      const { currentDoc, pages } = get();
      if (currentDoc?.id === doc.id && pages.length > 0) {
        get().togglePlayPause();
        return;
      }
      await get().stop();
      clearPreviewLayoutCache();
      set({
        status: 'loading',
        currentDoc: doc,
        errorMessage: null,
        pages: [],
        previewImageUris: [],
        previewTxtRaw: null,
        previewLoading: doc.type === 'pdf' || doc.type === 'txt',
      });

      const docId = doc.id;
      const docUri = doc.uri;
      const docType = doc.type;
      loadDocumentPreview(docUri, docId, docType)
        .then((preview) => {
          if (get().currentDoc?.id !== docId) return;
          set({
            previewImageUris: preview.imageUris,
            previewTxtRaw: preview.txtRaw,
            previewLoading: false,
          });
        })
        .catch((err) => {
          console.warn('Aperçu document:', err);
          if (get().currentDoc?.id === docId) {
            set({ previewLoading: false });
          }
        });

      try {
        // 1. Tenter de charger depuis le cache local
        const CACHE_KEY = contentCacheKey(doc.id);
        const cachedContent = await AsyncStorage.getItem(CACHE_KEY);

        let extracted: string[];
        if (cachedContent) {
          extracted = JSON.parse(cachedContent);
          if (isCachedExtractionFailure(extracted)) {
            await AsyncStorage.removeItem(CACHE_KEY);
            extracted = await extractText(doc.uri, doc.type, get().settings);
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(extracted));
          }
        } else {
          extracted = await extractText(doc.uri, doc.type, get().settings);
          if (!isCachedExtractionFailure(extracted)) {
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(extracted));
          }
        }

        const savedIdx = Math.round(doc.readingProgress * (extracted.length - 1));
        set({
          pages: extracted,
          currentPageIndex: Math.max(0, Math.min(savedIdx, extracted.length - 1)),
          currentChunkIndex: 0,
          status: 'idle',
          elapsedSeconds: doc.elapsedSeconds,
          currentDoc: { ...doc, totalPages: extracted.length },
        });
        await speakCurrent();
      } catch (err: any) {
        set({ status: 'error', errorMessage: err?.message ?? 'Erreur de lecture' });
      }
    },

    togglePlayPause: async () => {
      const { status, currentDoc, pages } = get();
      if (!currentDoc) return;
      if (status === 'playing') {
        await ttsService.pause();
        set({ status: 'paused' });
      } else if (status === 'paused') {
        set({ status: 'playing' });
        await ttsService.resume();
      } else if (status === 'idle' && pages.length > 0) {
        await speakCurrent();
      }
    },

    stop: async () => {
      await ttsService.stop();
      set({ status: 'idle' });
    },

    skipForward: async () => {
      const { pages, currentPageIndex } = get();
      if (!pages.length) return;
      await ttsService.stop();
      const next = Math.min(currentPageIndex + 1, pages.length - 1);
      set({ currentPageIndex: next, currentChunkIndex: 0 });
      await speakCurrent();
      saveProgress();
    },

    skipBackward: async () => {
      const { pages, currentPageIndex } = get();
      if (!pages.length) return;
      await ttsService.stop();
      const prev = Math.max(currentPageIndex - 1, 0);
      set({ currentPageIndex: prev, currentChunkIndex: 0 });
      await speakCurrent();
      saveProgress();
    },

    skipSentenceForward: async () => {
      await get().jumpToChunk(get().currentChunkIndex + 1);
    },

    skipSentenceBackward: async () => {
      await get().jumpToChunk(Math.max(0, get().currentChunkIndex - 1));
    },

    seekToProgress: async (ratio: number) => {
      const { pages } = get();
      if (!pages.length) return;
      await ttsService.stop();
      // Fix: multiply by (length - 1) so ratio=1.0 maps to last page, not out of bounds
      const idx = Math.round(ratio * (pages.length - 1));
      set({ currentPageIndex: Math.max(0, Math.min(idx, pages.length - 1)), currentChunkIndex: 0 });
      await speakCurrent();
      saveProgress();
    },

    tickSecond: () => {
      if (get().status === 'playing') {
        set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 }));
      }
    },

    jumpToChunk: async (chunkIndex: number) => {
      const { pages, currentPageIndex } = get();
      // Laisser _speakChunk gérer l'index hors-limite (avance de page naturelle)
      const safeIndex = Math.max(0, chunkIndex);
      await ttsService.stop();
      set({ currentChunkIndex: safeIndex, status: 'playing' });
      if (pages.length > 0 && currentPageIndex < pages.length) {
        await speakCurrent();
      }
    },

    getProgress: () => {
      const { pages, currentPageIndex } = get();
      if (!pages.length) return 0;
      // (pages.length - 1) pour que la dernière page == 1.0
      return currentPageIndex / (pages.length - 1 || 1);
    },

    setLanguage: async (lang: AppLanguage) => {
      let selectedVoiceId = get().settings.selectedVoiceId ?? '';
      try {
        const voices = await getVoicesForLocale(lang.ttsLocale);
        if (
          selectedVoiceId &&
          !voices.some((v) => v.identifier === selectedVoiceId)
        ) {
          selectedVoiceId = '';
        }
      } catch {
        /* garde la sélection actuelle */
      }
      const settings = { ...get().settings, language: lang, selectedVoiceId };
      set({ settings });
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    },
    setSelectedVoiceId: async (selectedVoiceId: string) => {
      const settings = { ...get().settings, selectedVoiceId };
      set({ settings });
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    },
    setSpeechRate: async (rate: number) => {
      const settings = { ...get().settings, speechRate: rate };
      set({ settings });
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    },
    setPitch: async (pitch: number) => {
      const settings = { ...get().settings, pitch };
      set({ settings });
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    },
    setTheme: async (theme: 'light' | 'dark') => {
      const settings = { ...get().settings, theme };
      set({ settings });
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    },
    setMistralApiKey: async (mistralApiKey: string) => {
      const settings = { ...get().settings, mistralApiKey };
      set({ settings });
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      await clearAllContentCaches(get().library);
    },
    setGoogleApiKey: async (googleApiKey: string) => {
      const settings = { ...get().settings, googleApiKey };
      set({ settings });
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      await clearAllContentCaches(get().library);
    },
  };
});

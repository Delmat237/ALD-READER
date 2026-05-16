import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { DocumentType } from '../types';
import { pdfToPageImages, deleteTempImages } from './pdfImageService';

const PREVIEW_ROOT = `${FileSystem.cacheDirectory}docuvoice_preview/`;

function previewManifestKey(docId: string): string {
  return `@docuvoice_preview_v1_${docId}`;
}

function normalizeFileUri(path: string): string {
  if (path.startsWith('file://') || path.startsWith('content://')) return path;
  if (path.startsWith('/')) return `file://${path}`;
  return path;
}

async function loadCachedPreviewImages(docId: string): Promise<string[] | null> {
  const raw = await AsyncStorage.getItem(previewManifestKey(docId));
  if (!raw) return null;
  try {
    const paths = JSON.parse(raw) as string[];
    if (!Array.isArray(paths) || paths.length === 0) return null;
    for (const p of paths) {
      const info = await FileSystem.getInfoAsync(p);
      if (!info.exists) return null;
    }
    return paths;
  } catch {
    return null;
  }
}

async function savePreviewCache(docId: string, paths: string[]): Promise<void> {
  await AsyncStorage.setItem(previewManifestKey(docId), JSON.stringify(paths));
}

/**
 * Rendu visuel page par page (PDF → PNG via PdfRenderer).
 * Indépendant de l’extraction de texte / OCR.
 */
export async function buildPdfPreviewImages(
  uri: string,
  docId: string
): Promise<string[]> {
  const cached = await loadCachedPreviewImages(docId);
  if (cached) return cached;

  const tempImages = await pdfToPageImages(uri);
  const dir = `${PREVIEW_ROOT}${docId}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const stableUris: string[] = [];
  for (let i = 0; i < tempImages.length; i++) {
    const dest = `${dir}page_${i}.png`;
    await FileSystem.copyAsync({
      from: normalizeFileUri(tempImages[i]),
      to: dest,
    });
    stableUris.push(normalizeFileUri(dest));
  }

  await deleteTempImages(tempImages);
  await savePreviewCache(docId, stableUris);
  return stableUris;
}

/** Contenu brut d’un TXT (fichier tel quel, sans découpage TTS). */
export async function loadTxtPreviewRaw(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(normalizeFileUri(uri), { encoding: 'utf8' });
}

export type DocumentPreview = {
  /** Une URI d’image par page (PDF). */
  imageUris: string[];
  /** Texte brut du fichier (TXT). */
  txtRaw: string | null;
};

export async function loadDocumentPreview(
  uri: string,
  docId: string,
  type: DocumentType
): Promise<DocumentPreview> {
  switch (type) {
    case 'pdf': {
      const imageUris = await buildPdfPreviewImages(uri, docId);
      return { imageUris, txtRaw: null };
    }
    case 'txt': {
      const txtRaw = await loadTxtPreviewRaw(uri);
      return { imageUris: [], txtRaw };
    }
    default:
      return { imageUris: [], txtRaw: null };
  }
}

export async function clearDocumentPreviewCache(docId: string): Promise<void> {
  await AsyncStorage.removeItem(previewManifestKey(docId));
  const dir = `${PREVIEW_ROOT}${docId}/`;
  await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => {});
}

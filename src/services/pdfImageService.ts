import { convert, convertB64 } from 'react-native-pdf-to-image';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const MAX_PDF_BYTES_FOR_B64_CONVERT = 12 * 1024 * 1024;
const RENDER_DPI = 150;

function normalizeFileUri(uri: string): string {
  if (uri.startsWith('file://') || uri.startsWith('content://')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
}

/** Copie vers le cache avec extension .pdf (certains modules natifs l’exigent). */
async function ensurePdfInCache(uri: string): Promise<string> {
  const src = normalizeFileUri(uri);
  const dest = `${FileSystem.cacheDirectory}ocr_${Date.now()}.pdf`;
  await FileSystem.copyAsync({ from: src, to: dest });
  return dest;
}

async function pdfUriForContentResolver(fileUri: string): Promise<string> {
  if (Platform.OS !== 'android') return fileUri;
  if (fileUri.startsWith('content://')) return fileUri;
  return FileSystem.getContentUriAsync(fileUri);
}

async function convertPdfFileToImages(fileUri: string): Promise<string[]> {
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) {
    throw new Error('Fichier PDF introuvable après copie dans le cache.');
  }
  if (typeof info.size === 'number' && info.size > MAX_PDF_BYTES_FOR_B64_CONVERT) {
    throw new Error(
      `PDF trop volumineux (${Math.round(info.size / 1024 / 1024)} Mo) pour la conversion locale.`
    );
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });
  // Typage npm incorrect (Promise<number>) — le natif renvoie { outputFiles: string[] }
  const result = (await convertB64(base64, RENDER_DPI)) as unknown as {
    outputFiles?: string[];
  };
  const outputFiles = result.outputFiles;
  if (!outputFiles?.length) {
    throw new Error('La conversion du PDF en images n’a produit aucune page.');
  }
  return outputFiles;
}

/**
 * Convertit un PDF en chemins d’images PNG (une par page).
 * Android : convertB64 en priorité (évite « No content provider » sur file://).
 * iOS : convert(uri) puis repli convertB64.
 */
export async function pdfToPageImages(uri: string): Promise<string[]> {
  const cachedPdf = await ensurePdfInCache(uri);
  const fileUri = normalizeFileUri(cachedPdf);

  if (Platform.OS === 'android') {
    return convertPdfFileToImages(fileUri);
  }

  try {
    const openUri = await pdfUriForContentResolver(fileUri);
    const { outputFiles } = await convert(openUri);
    if (outputFiles?.length) return outputFiles;
  } catch (e) {
    console.warn('pdfToPageImages: convert(uri) échoué, repli convertB64:', e);
  }

  return convertPdfFileToImages(fileUri);
}

export async function deleteTempImages(paths: string[]): Promise<void> {
  for (const p of paths) {
    FileSystem.deleteAsync(p, { idempotent: true }).catch(() => {});
  }
  // Fichier PDF temporaire du cache (pattern ocr_*.pdf) — best effort
}

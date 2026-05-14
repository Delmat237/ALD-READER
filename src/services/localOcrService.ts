import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { convert } from 'react-native-pdf-to-image';
import * as FileSystem from 'expo-file-system/legacy';
import { AppLanguage } from '../types';

// ML Kit supporte 5 scripts. Arabe et Cyrillique (ru) tombent en LATIN (best-effort).
function scriptForLanguage(lang: AppLanguage): TextRecognitionScript {
  switch (lang.code) {
    case 'zh': return TextRecognitionScript.CHINESE;
    case 'ja': return TextRecognitionScript.JAPANESE;
    case 'ko': return TextRecognitionScript.KOREAN;
    case 'hi': return TextRecognitionScript.DEVANAGARI;
    default:   return TextRecognitionScript.LATIN;
  }
}

/**
 * Extrait le texte d'un PDF scanné via OCR on-device (ML Kit).
 * Retourne un tableau de chaînes, une par page du PDF.
 */
export async function extractTextFromScannedPdf(
  uri: string,
  language: AppLanguage
): Promise<string[]> {
  // 1. Convertir chaque page du PDF en image PNG (API système Android/iOS)
  let outputFiles: string[] = [];
  try {
    const result = await convert(uri);
    outputFiles = result.outputFiles ?? [];
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error('react-native-pdf-to-image convert failed:', e);
    throw new Error(
      `Impossible de convertir le PDF en images (${m}). ` +
        'Vérifiez que le fichier est un PDF valide et qu’il n’est pas protégé.'
    );
  }
  if (!outputFiles || outputFiles.length === 0) {
    return ["Ce PDF n'a pu être converti en images. Il est peut-être corrompu ou protégé."];
  }

  const script = scriptForLanguage(language);
  const pages: string[] = [];

  try {
    // 2. OCR sur chaque image
    for (const imagePath of outputFiles) {
      const result = await TextRecognition.recognize(imagePath, script);
      const text = result.text.trim();
      if (text.length > 0) {
        pages.push(text);
      }
    }
  } finally {
    // 3. Supprimer les images temporaires quoi qu'il arrive
    for (const imagePath of outputFiles) {
      FileSystem.deleteAsync(imagePath, { idempotent: true }).catch(() => {});
    }
  }

  if (pages.length === 0) {
    return [
      "Aucun texte détecté dans ce PDF scanné.\n\n" +
      "Vérifiez que le document contient du texte imprimé lisible et non manuscrit.",
    ];
  }

  return pages;
}

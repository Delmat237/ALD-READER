import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import type { AppLanguage } from '../types';
import type { PlayerSettings } from '../types';
import { resolveApiKeys, hasCloudOcrKeys } from '../config/apiKeys';
import { isDeviceOnline } from './networkService';
import { pdfToPageImages, deleteTempImages } from './pdfImageService';
import { cloudOcrFromImages } from './cloudOcrService';

function scriptForLanguage(lang: AppLanguage): TextRecognitionScript {
  switch (lang.code) {
    case 'zh':
      return TextRecognitionScript.CHINESE;
    case 'ja':
      return TextRecognitionScript.JAPANESE;
    case 'ko':
      return TextRecognitionScript.KOREAN;
    case 'hi':
      return TextRecognitionScript.DEVANAGARI;
    default:
      return TextRecognitionScript.LATIN;
  }
}

async function localOcrFromImages(
  imagePaths: string[],
  language: AppLanguage
): Promise<string[]> {
  const script = scriptForLanguage(language);
  const pages: string[] = [];
  for (const imagePath of imagePaths) {
    const result = await TextRecognition.recognize(imagePath, script);
    const text = result.text.trim();
    if (text.length > 0) pages.push(text);
  }
  return pages;
}

/**
 * Extraction OCR d’un PDF : cloud (Mistral / Google) si en ligne + clé API,
 * sinon ML Kit on-device.
 */
export async function extractTextFromScannedPdf(
  uri: string,
  language: AppLanguage,
  settings: PlayerSettings
): Promise<string[]> {
  let imagePaths: string[] = [];
  try {
    imagePaths = await pdfToPageImages(uri);
    if (!imagePaths.length) {
      return [
        "Ce PDF n'a pu être converti en images. Il est peut-être corrompu ou protégé.",
      ];
    }

    const keys = resolveApiKeys(settings);
    const online = await isDeviceOnline();
    const useCloud = online && hasCloudOcrKeys(keys);

    let pages: string[] = [];
    if (useCloud) {
      try {
        pages = await cloudOcrFromImages(imagePaths, keys);
      } catch (cloudErr) {
        console.warn('OCR cloud échoué, repli ML Kit local:', cloudErr);
        pages = await localOcrFromImages(imagePaths, language);
      }
    } else {
      pages = await localOcrFromImages(imagePaths, language);
    }

    if (pages.length === 0) {
      return [
        'Aucun texte détecté dans ce PDF.\n\n' +
          (useCloud
            ? 'Essayez une autre clé API ou réessayez hors ligne (OCR local).'
            : 'Vérifiez que le document contient du texte imprimé lisible.'),
      ];
    }
    return pages;
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error('extractTextFromScannedPdf:', e);
    throw new Error(
      `Impossible de lire ce PDF (${m}). ` +
        'Réimportez le fichier ou configurez une clé Mistral / Google dans les paramètres.'
    );
  } finally {
    if (imagePaths.length) await deleteTempImages(imagePaths);
  }
}

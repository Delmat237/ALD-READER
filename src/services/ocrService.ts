import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { AppLanguage } from '../types';
import type { PlayerSettings } from '../types';
import { resolveApiKeys, hasCloudOcrKeys } from '../config/apiKeys';
import { isDeviceOnline } from './networkService';
import { pdfToPageImages, deleteTempImages } from './pdfImageService';
import { cloudOcrFromImages } from './cloudOcrService';

/**
 * ML Kit Android utilise InputImage.fromFilePath : un chemin sans schéma
 * (/data/.../xxx.png) provoque « No content provider ». iOS attend une URL file://.
 */
async function imageUriForMlKit(imagePath: string): Promise<string> {
  const fileUri =
    imagePath.startsWith('file://') || imagePath.startsWith('content://')
      ? imagePath
      : imagePath.startsWith('/')
        ? `file://${imagePath}`
        : imagePath;

  if (Platform.OS === 'android' && fileUri.startsWith('file://')) {
    try {
      return await FileSystem.getContentUriAsync(fileUri);
    } catch {
      return fileUri;
    }
  }
  return fileUri;
}

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
    const uri = await imageUriForMlKit(imagePath);
    const result = await TextRecognition.recognize(uri, script);
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
        'Réimportez le fichier. Si le message parle de « content provider », mettez à jour l’app (OTA). ' +
        'Pour l’OCR en ligne : Internet + clé Mistral ou Google dans Paramètres.'
    );
  } finally {
    if (imagePaths.length) await deleteTempImages(imagePaths);
  }
}

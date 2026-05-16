import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import TextRecognition, {
  TextRecognitionScript,
  type TextLine,
  type Frame,
} from '@react-native-ml-kit/text-recognition';
import type { AppLanguage } from '../types';

export type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const layoutCache = new Map<string, TextLine[]>();

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

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** OCR des lignes + cadres pour une image d’aperçu (cache en mémoire). */
export async function getPreviewLineLayout(
  imageUri: string,
  language: AppLanguage
): Promise<TextLine[]> {
  const cached = layoutCache.get(imageUri);
  if (cached) return cached;

  const uri = await imageUriForMlKit(imageUri);
  const result = await TextRecognition.recognize(uri, scriptForLanguage(language));
  const lines: TextLine[] = [];
  for (const block of result.blocks ?? []) {
    for (const line of block.lines ?? []) {
      if (line.frame && line.text.trim()) lines.push(line);
    }
  }
  layoutCache.set(imageUri, lines);
  return lines;
}

export function clearPreviewLayoutCache(): void {
  layoutCache.clear();
}

function findLinesForChunk(chunk: string, lines: TextLine[]): TextLine[] {
  const chunkNorm = normalizeForMatch(chunk);
  if (!chunkNorm || !lines.length) return [];

  let bestStart = -1;
  let bestEnd = -1;
  let bestScore = 0;

  for (let start = 0; start < lines.length; start++) {
    let combined = '';
    for (let end = start; end < lines.length && end < start + 12; end++) {
      combined += (combined ? ' ' : '') + lines[end].text;
      const combinedNorm = normalizeForMatch(combined);
      if (!combinedNorm) continue;

      let score = 0;
      if (chunkNorm.includes(combinedNorm)) score = combinedNorm.length;
      else if (combinedNorm.includes(chunkNorm)) score = chunkNorm.length;
      else {
        const w = chunkNorm.split(' ').filter((x) => x.length > 3)[0];
        if (w && combinedNorm.includes(w)) score = w.length;
      }

      if (score > bestScore) {
        bestScore = score;
        bestStart = start;
        bestEnd = end;
      }
    }
  }

  if (bestStart < 0) return [];
  return lines.slice(bestStart, bestEnd + 1);
}

/** Convertit les cadres OCR (pixels source) en coordonnées d’affichage (resizeMode: contain). */
export function highlightRectsForChunk(
  chunk: string,
  lines: TextLine[],
  sourceWidth: number,
  sourceHeight: number,
  displayWidth: number,
  displayHeight: number
): HighlightRect[] {
  if (!sourceWidth || !sourceHeight || !displayWidth || !displayHeight) return [];

  const matched = findLinesForChunk(chunk, lines);
  if (!matched.length) return [];

  const scale = Math.min(displayWidth / sourceWidth, displayHeight / sourceHeight);
  const dispW = sourceWidth * scale;
  const dispH = sourceHeight * scale;
  const offsetX = (displayWidth - dispW) / 2;
  const offsetY = (displayHeight - dispH) / 2;

  return matched
    .filter((l) => l.frame)
    .map((l) => {
      const f = l.frame as Frame;
      return {
        left: offsetX + f.left * scale,
        top: offsetY + f.top * scale,
        width: Math.max(4, f.width * scale),
        height: Math.max(4, f.height * scale),
      };
    });
}

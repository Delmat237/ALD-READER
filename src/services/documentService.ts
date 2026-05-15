import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import pako from 'pako';
import { DocumentType, PlayerSettings } from '../types';
import { extractTextFromScannedPdf } from './ocrService';

/**
 * Extracts readable text from a document.
 * Returns an array of pages/chapters (strings).
 */
export async function extractText(uri: string, type: DocumentType, settings: PlayerSettings): Promise<string[]> {
  switch (type) {
    case 'txt':
      return extractTxt(uri);
    case 'pdf':
      return extractPdf(uri, settings);
    case 'epub':
      return extractEpub(uri);
    default:
      throw new Error(`Format non supporté: ${type}`);
  }
}

async function extractTxt(uri: string): Promise<string[]> {
  const content = await FileSystem.readAsStringAsync(uri, {
    encoding: 'utf8',
  });
  return splitIntoChunks(cleanText(content));
}

/** Au-delà de ce poids, lire tout le PDF en base64 en JS risque de faire planter l’app (OOM). On passe direct à l’OCR. */
const MAX_PDF_BYTES_FOR_EMBEDDED_PARSE = 1.5 * 1024 * 1024;

async function extractPdf(uri: string, settings: PlayerSettings): Promise<string[]> {
  const ocrFallback = () => extractTextFromScannedPdf(uri, settings.language, settings);

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      return [
        "Fichier introuvable à l’emplacement enregistré.\n\n" +
          "Réimportez le document (le cache peut avoir été vidé après une mise à jour ou un redémarrage).",
      ];
    }

    const sizeBytes = typeof info.size === "number" ? info.size : 0;
    let localText = "";

    const skipEmbeddedRead =
      typeof info.size === "number" && info.size > MAX_PDF_BYTES_FOR_EMBEDDED_PARSE;

    // 1. Extraction embarquée : évite readAsStringAsync(base64) sur gros PDF → OOM / crash
    if (skipEmbeddedRead) {
      console.warn(
        `PDF: taille ${info.size} octets > seuil embarqué, OCR direct (évite crash mémoire sur base64).`
      );
    } else {
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
        localText = base64PdfToText(base64);
      } catch (embeddedErr) {
        console.warn("PDF: lecture ou parsing embarqué impossible, passage à l’OCR:", embeddedErr);
      }
    }

    if (embeddedPdfTextIsUsable(localText)) {
      return splitIntoChunks(cleanText(localText));
    }

    // 2. Pas de texte embarqué fiable → OCR (ML Kit + conversion page → image)
    return await ocrFallback();
  } catch (err: unknown) {
    console.error("PDF extraction error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const hint =
      msg.length > 0 && msg.length < 220
        ? `\n\nDétail technique : ${msg}`
        : "";
    return [
      "Ce PDF n'a pas pu être lu. Il est peut-être corrompu, protégé ou dans un format non pris en charge par la conversion." +
        hint,
    ];
  }
}

async function extractEpub(uri: string): Promise<string[]> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const zip = await JSZip.loadAsync(base64, { base64: true });

    // 1. Lire META-INF/container.xml pour trouver le fichier OPF
    let orderedFiles: string[] = [];
    const containerXml = await zip.files['META-INF/container.xml']?.async('string');
    if (containerXml) {
      const opfMatch = containerXml.match(/full-path="([^"]+\.opf)"/i);
      if (opfMatch) {
        const opfPath = opfMatch[1];
        const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
        const opfContent = await zip.files[opfPath]?.async('string');
        if (opfContent) {
          // Construire le manifest : id → href (uniquement XHTML)
          const manifest: Record<string, string> = {};
          const manifestRe = /<item\s[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"[^>]*\bmedia-type="application\/xhtml\+xml"/gi;
          let m;
          while ((m = manifestRe.exec(opfContent)) !== null) {
            manifest[m[1]] = opfDir + m[2];
          }
          // Lire le spine dans l'ordre déclaré
          const spineRe = /<itemref\s[^>]*\bidref="([^"]+)"/gi;
          while ((m = spineRe.exec(opfContent)) !== null) {
            const href = manifest[m[1]];
            if (href && zip.files[href]) orderedFiles.push(href);
          }
        }
      }
    }

    // 2. Fallback alphabétique si pas d'OPF lisible
    if (orderedFiles.length === 0) {
      orderedFiles = Object.keys(zip.files)
        .filter(f => f.endsWith('.html') || f.endsWith('.xhtml') || f.endsWith('.htm'))
        .sort();
    }

    // 3. Extraire le texte dans l'ordre
    const chapters: string[] = [];
    for (const file of orderedFiles) {
      const content = await zip.files[file].async('string');
      const text = stripHtml(content).trim();
      if (text.length > 50) chapters.push(text);
    }

    if (chapters.length > 0) {
      const finalChunks: string[] = [];
      for (const ch of chapters) {
        finalChunks.push(...splitIntoChunks(cleanText(ch)));
      }
      return finalChunks;
    }
  } catch (err) {
    console.error('EPUB extraction error:', err);
  }

  return ["Ce fichier EPUB n'a pas pu être lu. Il est peut-être protégé par DRM ou corrompu."];
}

/** 
 * Advanced PDF text extraction with spatial reconstruction.
 * Tracks (x, y) coordinates to reconstruct lines in reading order.
 */
function base64PdfToText(base64: string): string {
  try {
    // 1. Decode base64 to binary string safely
    const binary = atob(base64);
    const allTextBlocks: { text: string; x: number; y: number }[] = [];
    
    // 2. Find all streams
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    const filterRegex = /\/Filter\s*\/FlateDecode/;
    
    let match;
    while ((match = streamRegex.exec(binary)) !== null) {
      let content = match[1];
      const headIdx = Math.max(0, match.index - 300);
      const head = binary.substring(headIdx, match.index);
      
      if (filterRegex.test(head)) {
        try {
          const uint8 = new Uint8Array(content.length);
          for (let i = 0; i < content.length; i++) uint8[i] = content.charCodeAt(i);
          content = new TextDecoder('latin1').decode(pako.inflate(uint8));
        } catch (e) { continue; }
      }

      // Parse text blocks within BT...ET
      // We use a more permissive regex for BT...ET blocks
      const btEtRegex = /BT\s+([\s\S]*?)\s+ET/g;
      let btMatch;
      while ((btMatch = btEtRegex.exec(content)) !== null) {
        const block = btMatch[1];
        
        let curX = 0;
        let curY = 0;
        
        const lines = block.split(/[\r\n]+/);
        for (const line of lines) {
          // Position operators
          const tmMatch = line.match(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+Tm/);
          if (tmMatch) {
            curX = parseFloat(tmMatch[5]);
            curY = parseFloat(tmMatch[6]);
          }
          
          const tdMatch = line.match(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+Td/);
          if (tdMatch) {
            curX += parseFloat(tdMatch[1]);
            curY += parseFloat(tdMatch[2]);
          }

          // Text extraction (Tj or TJ)
          // Tj: (text) Tj
          const tjMatch = line.match(/\((.*?)\)\s*Tj/);
          if (tjMatch) {
            const text = decodePdfString(tjMatch[1]);
            if (text.trim().length > 0) {
              allTextBlocks.push({ text, x: curX, y: curY });
            }
          }
          
          // TJ: [(text) 123 (more text)] TJ
          const tJMatch = line.match(/\[(.*)\]\s*TJ/);
          if (tJMatch) {
            const parts = tJMatch[1].match(/\((.*?)\)|<([0-9A-Fa-f]*)>/g);
            if (parts) {
              const fullText = parts.map(p => {
                if (p.startsWith('(')) {
                  return decodePdfString(p.substring(1, p.length - 1));
                } else {
                  const hex = p.substring(1, p.length - 1);
                  let str = '';
                  for (let i = 0; i < hex.length; i += 2) {
                    str += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
                  }
                  return decodePdfString(str);
                }
              }).join('');
              
              if (fullText.trim().length > 0) {
                allTextBlocks.push({ text: fullText, x: curX, y: curY });
              }
            }
          }
        }
      }
    }

    if (allTextBlocks.length === 0) {
      // Pas de fallback sur le binaire : les chaînes "(...)" hors BT/ET sont
      // presque toujours métadonnées / polices / bruit → forcer l’OCR en aval.
      return '';
    }

    // Sort blocks by Y (desc) then X (asc)
    allTextBlocks.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 8) return a.x - b.x;
      return b.y - a.y;
    });

    let reconstructedText = '';
    let lastY = allTextBlocks[0].y;
    for (const block of allTextBlocks) {
      if (Math.abs(block.y - lastY) > 8) reconstructedText += '\n';
      else if (reconstructedText.length > 0) reconstructedText += ' ';
      
      reconstructedText += block.text;
      lastY = block.y;
    }

    return reconstructedText;
  } catch (err) {
    console.error('Advanced PDF parsing error:', err);
    return '';
  }
}

/**
 * Attempts to decode common PDF character mappings for French.
 */
function decodePdfString(str: string): string {
  if (!str) return '';
  
  // 1. Handle octal escape sequences \ddd
  let decoded = str.replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));

  // 2. Handle basic escapes
  decoded = decoded
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');

  // 3. French character mapping for common PDF encodings (WinAnsi, ISO-Latin-1)
  decoded = decoded
    .replace(/\u00B4e/g, 'é').replace(/Ã©/g, 'é')
    .replace(/\u0060e/g, 'è').replace(/Ã¨/g, 'è')
    .replace(/\u005Ee/g, 'ê').replace(/Ãª/g, 'ê')
    .replace(/\u00A8e/g, 'ë').replace(/Ã«/g, 'ë')
    .replace(/\u0060a/g, 'à').replace(/Ã /g, 'à')
    .replace(/\u005Ea/g, 'â').replace(/Ã¢/g, 'â')
    .replace(/\u005Ei/g, 'î').replace(/Ã®/g, 'î')
    .replace(/\u00A8i/g, 'ï').replace(/Ã¯/g, 'ï')
    .replace(/\u005Eo/g, 'ô').replace(/Ã´/g, 'ô')
    .replace(/\u005Eu/g, 'û').replace(/Ã»/g, 'û')
    .replace(/\u0060u/g, 'ù').replace(/Ã¹/g, 'ù')
    .replace(/\u00B8c/g, 'ç').replace(/Ã§/g, 'ç')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE');

  // 4. Remove control characters
  decoded = decoded.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  
  return decoded;
}

function stripHtml(html: string): string {
  return html
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    // Entités numériques décimales et hexadécimales
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    // Entités nommées courantes (espaces, ponctuation)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')
    // Caractères accentués fréquents dans les EPUBs multilingues
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&ecirc;/g, 'ê').replace(/&euml;/g, 'ë')
    .replace(/&agrave;/g, 'à').replace(/&acirc;/g, 'â').replace(/&auml;/g, 'ä').replace(/&aelig;/g, 'æ')
    .replace(/&icirc;/g, 'î').replace(/&iuml;/g, 'ï')
    .replace(/&ocirc;/g, 'ô').replace(/&ouml;/g, 'ö').replace(/&oslash;/g, 'ø')
    .replace(/&ucirc;/g, 'û').replace(/&ugrave;/g, 'ù').replace(/&uuml;/g, 'ü')
    .replace(/&ccedil;/g, 'ç').replace(/&oelig;/g, 'œ').replace(/&OElig;/g, 'Œ')
    .replace(/&ntilde;/g, 'ñ').replace(/&szlig;/g, 'ß')
    .replace(/&Eacute;/g, 'É').replace(/&Egrave;/g, 'È').replace(/&Agrave;/g, 'À')
    // Fallback : supprimer toute entité restante
    .replace(/&[a-z]{2,8};/gi, ' ');
}

function cleanText(text: string): string {
  if (!text) return '';

  return text
    // 1. Standardize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    
    // 2. Remove common PDF "Noise"
    .replace(/^Page \d+ of \d+$/gm, '') 
    .replace(/^\d+$/gm, '')             
    .replace(/^-+$/gm, '')              
    
    .replace(/https?:\/\/\S+/gi, '[lien]')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/\.{4,}/g, '...')
    
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Supprime les balises Markdown pour éviter que le TTS ne les lise (ex: "astérisque").
 */

/**
 * Texte embarqué PDF jugé exploitable sans OCR (seuil plus strict qu’avant).
 */
function embeddedPdfTextIsUsable(text: string): boolean {
  const t = text.trim();
  if (t.length < 120) return false;
  if (isGarbageText(t)) return false;

  // Prose lisible : assez de « mots » séparés par des espaces (évite un seul bloc compact)
  if (t.length >= 350) {
    const words = t.split(/\s+/).filter((w) => w.length > 1);
    if (words.length < Math.max(8, Math.floor(t.length / 90))) return false;
  }

  return true;
}

/**
 * Détecte si un texte est du "charabia" (Mojibake/Encodage corrompu / glyphes mal mappés).
 */
function isGarbageText(text: string): boolean {
  if (!text || text.length < 50) return false;

  // Check 1: caractères hors plages Unicode reconnues (seuil resserré)
  const allowed = /[a-zA-Z0-9\s.,!?;:()\-’"«»À-ɏЀ-ӿ؀-ۿऀ-ॿ一-鿿぀-ヿ가-힯’-‟…–—]/;
  let specialCount = 0;
  for (const ch of text) {
    if (!allowed.test(ch)) specialCount++;
  }
  if (specialCount / text.length > 0.18) return true;

  // Check 2: densité élevée de Latin étendu U+0080–U+024F (polices PDF remappées)
  let nonAsciiLatinCount = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 127 && code < 0x0250) nonAsciiLatinCount++;
  }
  if (nonAsciiLatinCount / text.length > 0.22) return true;

  // Check 3: signatures mojibake UTF-8 lu comme Latin-1 / Windows-1252
  if (text.length >= 80) {
    const mojibake = text.match(/\u00c3[\u00a0-\u00ff]|\u00c2[\u0080-\u00bf]/g);
    if (mojibake && mojibake.length / text.length > 0.012) return true;
  }

  // Check 4: très peu d’espaces sur un long extrait (concaténation / binaire)
  if (text.length >= 400) {
    const ws = (text.match(/\s/g) || []).length;
    if (ws / text.length < 0.045) return true;
  }

  // Check 5: ponctuation ASCII + chiffres anormalement denses (pas une prose normale)
  if (text.length >= 120) {
    let symdig = 0;
    for (const ch of text) {
      const c = ch.charCodeAt(0);
      if ((c >= 33 && c <= 47) || (c >= 58 && c <= 64) || (c >= 91 && c <= 96) || (c >= 123 && c <= 126) || (c >= 48 && c <= 57)) {
        symdig++;
      }
    }
    if (symdig / text.length > 0.16) return true;
  }

  return false;
}

function splitIntoChunks(text: string, maxLen = 1500): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length > maxLen) {
      if (current) chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

export function typeFromExtension(filename: string): DocumentType {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'epub') return 'epub';
  if (ext === 'txt') return 'txt';
  return 'unknown';
}

export function typeColor(type: DocumentType): string {
  switch (type) {
    case 'pdf': return '#FF6B6B';
    case 'epub': return '#6BA8FF';
    case 'txt': return '#52D9A4';
    default: return '#888';
  }
}

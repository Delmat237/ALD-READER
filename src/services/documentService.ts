import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import pako from 'pako';
import { DocumentType, PlayerSettings } from '../types';
import { extractTextFromScannedPdf } from './localOcrService';

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

async function extractPdf(uri: string, settings: PlayerSettings): Promise<string[]> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

    // 1. Extraction directe du texte embarqué (rapide, 100 % hors-ligne)
    const localText = base64PdfToText(base64);
    if (localText.trim().length > 100 && !isGarbageText(localText)) {
      return splitIntoChunks(cleanText(localText));
    }

    // 2. PDF scanné détecté → OCR on-device via ML Kit (hors-ligne, aucune clé API)
    return await extractTextFromScannedPdf(uri, settings.language);
  } catch (err) {
    console.error('PDF extraction error:', err);
    return ["Ce PDF n'a pas pu être lu. Il est peut-être corrompu ou protégé."];
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
      // Last resort: direct string search in binary
      const fallbackRegex = /\(([^)]{5,})\)/g;
      let fMatch;
      const fragments = [];
      while ((fMatch = fallbackRegex.exec(binary)) !== null) {
        const decoded = decodePdfString(fMatch[1]);
        if (decoded.length > 10 && !decoded.includes('/') && !decoded.includes('\\')) {
          fragments.push(decoded);
        }
      }
      return fragments.join(' ');
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
 * Détecte si un texte est du "charabia" (Mojibake/Encodage corrompu).
 * Analyse le ratio de caractères spéciaux par rapport aux caractères alphanumériques.
 */
function isGarbageText(text: string): boolean {
  if (!text || text.length < 50) return false;

  // Check 1: caractères hors plages Unicode reconnues
  const allowed = /[a-zA-Z0-9\s.,!?;:()\-’"«»À-ɏЀ-ӿ؀-ۿऀ-ॿ一-鿿぀-ヿ가-힯’-‟…–—]/;
  let specialCount = 0;
  for (const ch of text) {
    if (!allowed.test(ch)) specialCount++;
  }
  if (specialCount / text.length > 0.25) return true;

  // Check 2: densité anormalement élevée de caractères Latin non-ASCII (U+0080–U+024F).
  // Les PDFs avec polices personnalisées remappent les octets vers cette plage → ~50 % du texte.
  // Du vrai texte français n’en contient que ~5–15 %.
  let nonAsciiLatinCount = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 127 && code < 0x0250) nonAsciiLatinCount++;
  }
  if (nonAsciiLatinCount / text.length > 0.30) return true;

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

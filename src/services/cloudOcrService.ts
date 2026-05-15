import * as FileSystem from 'expo-file-system/legacy';
import type { ResolvedApiKeys } from '../config/apiKeys';

const OCR_PROMPT =
  'Extrais tout le texte lisible de cette image de document. ' +
  'Conserve la structure (paragraphes, listes). Réponds uniquement avec le texte extrait, sans commentaire.';

const MAX_CLOUD_PAGES = 25;

async function imagePathToBase64(imagePath: string): Promise<string> {
  const uri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`;
  return FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
}

async function ocrWithMistral(imageBase64: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'pixtral-12b-2409',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            {
              type: 'image_url',
              image_url: `data:image/png;base64,${imageBase64}`,
            },
          ],
        },
      ],
      temperature: 0.1,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mistral OCR (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Mistral OCR: réponse vide');
  }
  return text.trim();
}

async function ocrWithGoogle(imageBase64: string, apiKey: string): Promise<string> {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
    encodeURIComponent(apiKey);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: OCR_PROMPT },
            { inline_data: { mime_type: 'image/png', data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google AI OCR (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = parts?.map((p: { text?: string }) => p.text).filter(Boolean).join('\n');
  if (!text?.trim()) {
    throw new Error('Google AI OCR: réponse vide');
  }
  return text.trim();
}

async function ocrOnePage(imagePath: string, keys: ResolvedApiKeys): Promise<string> {
  const b64 = await imagePathToBase64(imagePath);
  if (keys.mistral) {
    try {
      return await ocrWithMistral(b64, keys.mistral);
    } catch (e) {
      console.warn('Mistral OCR page failed, fallback Google:', e);
      if (!keys.google) throw e;
    }
  }
  if (keys.google) {
    return await ocrWithGoogle(b64, keys.google);
  }
  throw new Error('Aucune clé API cloud configurée.');
}

/** OCR cloud page par page (Mistral prioritaire, puis Google). */
export async function cloudOcrFromImages(
  imagePaths: string[],
  keys: ResolvedApiKeys
): Promise<string[]> {
  const limited = imagePaths.slice(0, MAX_CLOUD_PAGES);
  const pages: string[] = [];
  for (const path of limited) {
    const text = await ocrOnePage(path, keys);
    if (text.length > 0) pages.push(text);
  }
  if (imagePaths.length > MAX_CLOUD_PAGES) {
    pages.push(
      `\n[${imagePaths.length - MAX_CLOUD_PAGES} page(s) non traitées en ligne — limite ${MAX_CLOUD_PAGES} pages.]`
    );
  }
  return pages;
}

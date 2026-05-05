/**
 * Splits text into TTS-friendly chunks by sentence boundaries.
 * Mirrors the logic used in both TTSService and ReaderView — single source of truth.
 */
export function splitIntoSpeechChunks(text: string, maxLen = 500): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if (current.length + s.length > maxLen) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

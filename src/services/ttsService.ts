import * as Speech from 'expo-speech';
import { AppLanguage, VoiceGender } from '../types';
import { splitIntoSpeechChunks } from '../utils/text';

type SpeechOptions = {
  language: AppLanguage;
  rate: number;
  pitch: number;
  volume: number;
  voiceGender: VoiceGender;
  onDone?: () => void;
  onError?: (err: string) => void;
  onStart?: () => void;
  onChunkStart?: (index: number) => void;
};

class TTSService {
  private _speaking = false;
  private _paused = false;
  private _currentOptions: SpeechOptions | null = null;
  private _pendingChunks: string[] = [];
  private _chunkIndex = 0;
  private _selectedVoice: string | undefined = undefined;

  get isSpeaking() { return this._speaking; }
  get isPaused() { return this._paused; }

  async speak(text: string, options: SpeechOptions, startIndex = 0) {
    await this.stop();
    this._currentOptions = options;
    this._speaking = true;
    this._paused = false;

    this._pendingChunks = splitIntoSpeechChunks(text);
    this._chunkIndex = Math.min(startIndex, this._pendingChunks.length - 1);

    // Resolve voice once per speak() call — avoids repeated async calls per chunk
    this._selectedVoice = await this._resolveVoice(
      options.language.ttsLocale,
      options.voiceGender
    );

    options.onStart?.();
    this._speakChunk();
  }

  private _speakChunk() {
    if (this._chunkIndex >= this._pendingChunks.length) {
      this._speaking = false;
      this._currentOptions?.onDone?.();
      return;
    }

    const chunk = this._pendingChunks[this._chunkIndex];
    const opts = this._currentOptions!;

    Speech.speak(chunk, {
      language: opts.language.ttsLocale,
      voice: this._selectedVoice,
      rate: opts.rate,
      pitch: opts.pitch,
      volume: opts.volume,
      onStart: () => {
        opts.onChunkStart?.(this._chunkIndex);
      },
      onDone: () => {
        if (!this._paused && this._speaking) {
          this._chunkIndex++;
          this._speakChunk();
        }
      },
      onError: (err) => {
        this._speaking = false;
        opts.onError?.(err.message ?? 'TTS error');
      },
    });
  }

  async pause() {
    if (this._speaking && !this._paused) {
      this._paused = true;
      await Speech.stop();
    }
  }

  async resume() {
    if (this._paused && this._currentOptions) {
      this._paused = false;
      this._speakChunk();
    }
  }

  async stop() {
    this._speaking = false;
    this._paused = false;
    this._pendingChunks = [];
    this._chunkIndex = 0;
    await Speech.stop();
  }

  async getAvailableVoices() {
    return Speech.getAvailableVoicesAsync();
  }

  /**
   * Finds the best matching voice for the given locale and gender preference.
   * Returns undefined if no match found — expo-speech falls back to system default.
   */
  private async _resolveVoice(locale: string, gender: VoiceGender): Promise<string | undefined> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      if (!voices.length) return undefined;

      const langCode = locale.slice(0, 2).toLowerCase();

      // 1. Filter by language (exact locale first, then language code)
      const byLocale = voices.filter(
        (v) => v.language.toLowerCase() === locale.toLowerCase()
      );
      const byLang = voices.filter(
        (v) => v.language.toLowerCase().startsWith(langCode)
      );
      const pool = byLocale.length ? byLocale : byLang;
      if (!pool.length) return undefined;

      if (gender === 'neutral') return pool[0].identifier;

      // 2. Advanced Match by gender hint
      // Android/Google: -A/-C (Female), -B/-D (Male)
      // iOS: Names (Thomas=Male, Audrey/Aurelie=Female)
      const isMale = gender === 'male';
      const hints = isMale 
        ? ['male', 'homme', '-b', '-d', 'thomas', 'nicolas', 'paul', 'jean', 'daniel'] 
        : ['female', 'femme', '-a', '-c', 'audrey', 'aurelie', 'amelie', 'celine', 'alice'];

      const matched = pool.find((v) => {
        const name = v.name.toLowerCase();
        const id = v.identifier.toLowerCase();
        return hints.some(h => name.includes(h) || id.includes(h));
      });

      // 3. If no hint match, try to pick a different voice than the default if available
      if (!matched && pool.length > 1) {
        if (isMale) {
          // Heuristic: The first voice is almost always female on most systems
          // so we pick the second one for male.
          return pool[1].identifier;
        } else {
          // If we want female and no hint, pick the first one
          return pool[0].identifier;
        }
      }

      return (matched ?? pool[0]).identifier;
    } catch {
      return undefined;
    }
  }
}

export const ttsService = new TTSService();

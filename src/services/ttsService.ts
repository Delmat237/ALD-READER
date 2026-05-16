import * as Speech from 'expo-speech';
import { AUTO_VOICE_ID } from './voiceService';
import { AppLanguage } from '../types';
import { splitIntoSpeechChunks } from '../utils/text';

type SpeechOptions = {
  language: AppLanguage;
  rate: number;
  pitch: number;
  volume: number;
  /** Identifiant voix appareil, ou vide pour la voix par défaut du système. */
  voiceId: string;
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

    const id = options.voiceId?.trim();
    this._selectedVoice = id && id !== AUTO_VOICE_ID ? id : undefined;

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
}

export const ttsService = new TTSService();

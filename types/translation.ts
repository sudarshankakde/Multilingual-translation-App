export interface Translation {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
  type: 'text' | 'camera' | 'pdf' | 'gallery';
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationResponse {
  translatedText: string;
  detectedLanguage?: string;
}

export interface TTSVoice {
  identifier: string;
  name: string;
  language: string;
  quality: string;
}

export interface TTSSettings {
  voice: string;
  pitch: number;
  rate: number;
  volume: number;
}
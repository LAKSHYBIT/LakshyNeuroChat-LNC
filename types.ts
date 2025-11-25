export enum AppMode {
  CHAT = 'CHAT',
  IMAGE_GEN = 'IMAGE_GEN',
  VIDEO_GEN = 'VIDEO_GEN',
  LIVE = 'LIVE'
}

export enum ModelTier {
  FAST = 'FAST', // Flash-Lite
  STANDARD = 'STANDARD', // Flash
  PRO = 'PRO' // Pro 3
}

export interface GroundingChunk {
  web?: { uri: string; title: string };
  maps?: { 
    uri: string; 
    title: string;
    placeAnswerSources?: { reviewSnippets?: { url: string }[] }[] 
  };
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text?: string;
  image?: string; // base64
  videoUri?: string; // url
  audioData?: string; // base64
  isThinking?: boolean;
  grounding?: GroundingChunk[];
  timestamp: number;
}

export interface ChatConfig {
  useSearch: boolean;
  useMaps: boolean;
  useThinking: boolean;
  modelTier: ModelTier;
}

export interface VideoConfig {
  aspectRatio: '16:9' | '9:16';
  resolution: '720p' | '1080p';
}

export interface ImageConfig {
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  size: '1K' | '2K' | '4K'; // Only for Pro
}

// Augment window for Veo key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // aistudio is already defined in the environment with type AIStudio
    webkitAudioContext?: typeof AudioContext;
  }
}
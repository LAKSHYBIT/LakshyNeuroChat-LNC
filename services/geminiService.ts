import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ChatConfig, ImageConfig, VideoConfig, ModelTier } from "../types";

// Helper to get a fresh client (needed for Veo key updates)
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * TEXT & CHAT GENERATION
 */
export const generateChatResponse = async (
  prompt: string,
  history: { role: string; parts: any[] }[],
  files: { data: string; mimeType: string }[],
  config: ChatConfig,
  geoLocation?: { latitude: number; longitude: number }
) => {
  const ai = getClient();
  
  let modelName = 'gemini-2.5-flash'; // Standard Default
  
  if (config.modelTier === ModelTier.FAST) {
    modelName = 'gemini-flash-lite-latest';
  } else if (config.modelTier === ModelTier.PRO || config.useThinking) {
    modelName = 'gemini-3-pro-preview';
  }

  // Tools setup
  const tools: any[] = [];
  if (config.useSearch) {
    tools.push({ googleSearch: {} });
  }
  if (config.useMaps) {
    tools.push({ googleMaps: {} });
  }

  // Tool Config for Location
  let toolConfig = undefined;
  if (config.useMaps && geoLocation) {
    toolConfig = {
      retrievalConfig: {
        latLng: {
          latitude: geoLocation.latitude,
          longitude: geoLocation.longitude
        }
      }
    };
  }

  // Thinking Config
  let thinkingConfig = undefined;
  if (config.useThinking && modelName === 'gemini-3-pro-preview') {
    thinkingConfig = { thinkingBudget: 32768 };
  }

  // Construct contents
  const parts: any[] = [];
  files.forEach(f => {
    parts.push({ inlineData: { data: f.data, mimeType: f.mimeType } });
  });
  parts.push({ text: prompt });

  const reqConfig: any = {
    tools: tools.length > 0 ? tools : undefined,
    toolConfig,
  };

  if (thinkingConfig) {
    reqConfig.thinkingConfig = thinkingConfig;
    // Do not set maxOutputTokens when using thinking
  } 

  // If using Flash Image for EDITING (detected via logic in App or explicit user intent, 
  // but here we are in generic chat. If file is present and user asks for edit, 
  // we might want 2.5 flash image, but Pro 3 can also handle image ops. 
  // For explicit "Edit this image" feature, see separate function below.
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts },
    config: reqConfig
  });

  return response;
};

/**
 * IMAGE GENERATION
 */
export const generateImage = async (prompt: string, config: ImageConfig) => {
  const ai = getClient();
  const model = 'gemini-3-pro-image-preview'; // Nano Banana Pro

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: config.aspectRatio,
        imageSize: config.size
      }
    }
  });
  return response;
};

/**
 * IMAGE EDITING (Gemini 2.5 Flash Image)
 */
export const editImage = async (prompt: string, base64Image: string, mimeType: string) => {
  const ai = getClient();
  const model = 'gemini-2.5-flash-image';

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { text: prompt }
      ]
    }
  });
  return response;
};

/**
 * VIDEO GENERATION (Veo)
 */
export const generateVeoVideo = async (prompt: string, config: VideoConfig, inputImage?: { data: string, mimeType: string }) => {
  // Ensure key is selected
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success after dialog interaction, proceed with new client
    }
  }

  const ai = getClient(); // Create NEW client to pick up potential new key
  const model = 'veo-3.1-fast-generate-preview';

  let operation;
  
  const veoConfig = {
    numberOfVideos: 1,
    resolution: config.resolution,
    aspectRatio: config.aspectRatio
  };

  if (inputImage) {
    operation = await ai.models.generateVideos({
      model,
      prompt,
      image: {
        imageBytes: inputImage.data,
        mimeType: inputImage.mimeType
      },
      config: veoConfig
    });
  } else {
    operation = await ai.models.generateVideos({
      model,
      prompt,
      config: veoConfig
    });
  }

  // Polling
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("No video generated");

  // Fetch the actual bytes
  const res = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
  if (!res.ok) throw new Error("Failed to download video bytes");
  return await res.blob();
};

/**
 * TTS
 */
export const generateSpeech = async (text: string) => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

/**
 * TRANSCRIPTION
 */
export const transcribeAudio = async (audioBase64: string, mimeType: string) => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        { inlineData: { data: audioBase64, mimeType } },
        { text: "Transcribe this audio exactly." }
      ]
    }
  });
  return response.text;
};

/**
 * LIVE API Helper (Exposed for Component usage)
 */
export const getLiveClient = () => getClient();

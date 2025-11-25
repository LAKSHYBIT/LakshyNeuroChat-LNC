import React, { useState, useRef, useEffect } from 'react';
import { Message, ChatConfig, ModelTier, ImageConfig, VideoConfig } from '../types';
import { generateChatResponse, generateImage, generateVeoVideo, editImage, generateSpeech, transcribeAudio } from '../services/geminiService';
import { GoogleGenAI } from '@google/genai';

interface ChatInterfaceProps {
  mode: 'CHAT' | 'IMAGE_GEN' | 'VIDEO_GEN';
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ mode }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: `Hello! I am Nano-Banana. How can I assist you today?`, timestamp: Date.now() }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<{data: string, mimeType: string, preview: string}[]>([]);
  
  // Settings
  const [config, setConfig] = useState<ChatConfig>({
    useSearch: false,
    useMaps: false,
    useThinking: false,
    modelTier: ModelTier.STANDARD
  });
  
  const [imgConfig, setImgConfig] = useState<ImageConfig>({ aspectRatio: '1:1', size: '1K' });
  const [vidConfig, setVidConfig] = useState<VideoConfig>({ aspectRatio: '16:9', resolution: '720p' });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  // Geolocation
  const [location, setLocation] = useState<{latitude: number, longitude: number} | undefined>(undefined);
  useEffect(() => {
    if (config.useMaps && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      });
    }
  }, [config.useMaps]);

  const handleSend = async () => {
    if ((!inputText.trim() && files.length === 0) || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      image: files.find(f => f.mimeType.startsWith('image'))?.data, // For UI display
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    const currentFiles = [...files];
    setFiles([]); // Clear inputs
    setIsLoading(true);

    try {
      let responseText = '';
      let generatedImage = undefined;
      let videoUri = undefined;
      let groundingData = undefined;

      if (mode === 'CHAT') {
         // Check for explicit "Edit" intent if image is attached
         const isEdit = currentFiles.length > 0 && inputText.toLowerCase().includes('edit');
         
         if (isEdit) {
            const res = await editImage(userMsg.text || 'Edit this image', currentFiles[0].data, currentFiles[0].mimeType);
            // Check candidates for image part
             for (const part of res.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    generatedImage = part.inlineData.data;
                } else if (part.text) {
                    responseText += part.text;
                }
             }
         } else {
            const res = await generateChatResponse(userMsg.text || '', [], currentFiles, config, location);
            responseText = res.text || '';
            groundingData = res.candidates?.[0]?.groundingMetadata?.groundingChunks;
         }

      } else if (mode === 'IMAGE_GEN') {
         const res = await generateImage(userMsg.text || 'Generate an image', imgConfig);
         for (const part of res.candidates?.[0]?.content?.parts || []) {
             if (part.inlineData) {
                 generatedImage = part.inlineData.data;
             }
             if (part.text) responseText += part.text;
         }
      } else if (mode === 'VIDEO_GEN') {
         const blob = await generateVeoVideo(userMsg.text || 'Generate video', vidConfig, currentFiles[0] ? { data: currentFiles[0].data, mimeType: currentFiles[0].mimeType } : undefined);
         videoUri = URL.createObjectURL(blob);
         responseText = "Here is your generated video using Veo 3.";
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        image: generatedImage,
        videoUri: videoUri,
        grounding: groundingData,
        timestamp: Date.now()
      }]);

    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: `Error: ${err.message || 'Something went wrong.'}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setFiles([{
            data: base64,
            mimeType: file.type,
            preview: reader.result as string
        }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const playTTS = async (text: string) => {
    try {
        const audioBase64 = await generateSpeech(text);
        if (audioBase64) {
             const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
             audio.play();
        }
    } catch (e) {
        alert("TTS Failed");
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white relative">
      
      {/* Header / Config Bar */}
      <div className="h-16 border-b border-gray-800 flex items-center px-6 justify-between shrink-0">
         <h2 className="text-lg font-semibold flex items-center gap-2">
            {mode === 'CHAT' ? '💬 Chat' : mode === 'IMAGE_GEN' ? '🎨 Studio' : '🎬 Veo'}
         </h2>
         
         <div className="flex items-center space-x-4 text-sm">
           {mode === 'CHAT' && (
             <>
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={config.useThinking} onChange={e => setConfig({...config, useThinking: e.target.checked})} className="accent-yellow-500" />
                    <span className={config.useThinking ? "text-yellow-400 font-bold" : "text-gray-400"}>🧠 Think</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer hidden md:flex">
                    <input type="checkbox" checked={config.useSearch} onChange={e => setConfig({...config, useSearch: e.target.checked})} className="accent-blue-500" />
                    <span className={config.useSearch ? "text-blue-400" : "text-gray-400"}>🌐 Search</span>
                </label>
                 <label className="flex items-center space-x-2 cursor-pointer hidden md:flex">
                    <input type="checkbox" checked={config.useMaps} onChange={e => setConfig({...config, useMaps: e.target.checked})} className="accent-green-500" />
                    <span className={config.useMaps ? "text-green-400" : "text-gray-400"}>🗺️ Maps</span>
                </label>
                <select 
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                  value={config.modelTier}
                  onChange={(e) => setConfig({...config, modelTier: e.target.value as ModelTier})}
                >
                    <option value={ModelTier.FAST}>Flash-Lite (Fast)</option>
                    <option value={ModelTier.STANDARD}>Flash (Standard)</option>
                    <option value={ModelTier.PRO}>Pro 3 (Smart)</option>
                </select>
             </>
           )}
           {mode === 'IMAGE_GEN' && (
              <select className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                 value={imgConfig.aspectRatio} onChange={e => setImgConfig({...imgConfig, aspectRatio: e.target.value as any})}>
                  <option value="1:1">1:1 Square</option>
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Portrait</option>
              </select>
           )}
           {mode === 'VIDEO_GEN' && (
              <select className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                 value={vidConfig.aspectRatio} onChange={e => setVidConfig({...vidConfig, aspectRatio: e.target.value as any})}>
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Portrait</option>
              </select>
           )}
         </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 ${
              msg.role === 'user' 
                ? 'bg-yellow-500 text-black rounded-tr-none' 
                : 'bg-gray-800 text-gray-100 rounded-tl-none border border-gray-700'
            }`}>
              
              {/* User Input Image */}
              {msg.image && msg.role === 'user' && (
                 <img src={`data:image/jpeg;base64,${msg.image}`} alt="upload" className="max-h-60 rounded-lg mb-2" />
              )}

              {/* Text Content */}
              {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}

              {/* Generated Content */}
              {msg.image && msg.role === 'model' && (
                <div className="mt-3">
                   <img src={`data:image/png;base64,${msg.image}`} alt="generated" className="rounded-lg shadow-lg w-full max-w-md" />
                   <a href={`data:image/png;base64,${msg.image}`} download="generated.png" className="text-xs text-blue-400 mt-1 block hover:underline">Download Image</a>
                </div>
              )}
              
              {msg.videoUri && (
                <div className="mt-3">
                    <video src={msg.videoUri} controls className="rounded-lg w-full max-w-md" />
                </div>
              )}

              {/* Grounding Data */}
              {msg.grounding && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {msg.grounding.map((chunk, i) => {
                        if (chunk.web) return <a key={i} href={chunk.web.uri} target="_blank" rel="noreferrer" className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded border border-blue-800 hover:bg-blue-800 truncate max-w-xs">{chunk.web.title}</a>
                        if (chunk.maps) return <a key={i} href={chunk.maps.uri} target="_blank" rel="noreferrer" className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded border border-green-800 hover:bg-green-800 truncate max-w-xs">📍 {chunk.maps.title}</a>
                        return null;
                    })}
                </div>
              )}

              {/* Controls */}
              {msg.role === 'model' && msg.text && (
                  <button onClick={() => playTTS(msg.text || '')} className="mt-2 text-gray-500 hover:text-yellow-400 transition-colors">
                    🔊
                  </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start animate-pulse">
                <div className="bg-gray-800 p-4 rounded-2xl rounded-tl-none border border-gray-700">
                   <span className="text-yellow-500">Nano-Banana is {config.useThinking ? 'Thinking Deeply...' : 'typing...'}</span>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-900 border-t border-gray-800 shrink-0">
        <div className="relative flex items-end gap-2 max-w-4xl mx-auto">
            
            {/* File Input */}
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className={`p-3 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors text-gray-400 ${files.length > 0 ? 'border-2 border-yellow-500 text-yellow-500' : ''}`}
            >
                ➕
            </button>

            {/* Text Input */}
            <div className="flex-1 bg-gray-800 rounded-2xl border border-gray-700 focus-within:border-yellow-500 transition-colors flex flex-col">
                {files.length > 0 && (
                    <div className="px-4 pt-2">
                        <div className="relative inline-block">
                             <img src={files[0].preview} alt="preview" className="h-12 w-12 object-cover rounded-md border border-gray-600" />
                             <button onClick={() => setFiles([])} className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center text-xs text-white">×</button>
                        </div>
                    </div>
                )}
                <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                    placeholder={mode === 'CHAT' ? "Ask me anything..." : mode === 'IMAGE_GEN' ? "Describe the image..." : "Describe the video..."}
                    className="w-full bg-transparent text-white p-3 focus:outline-none resize-none max-h-32"
                    rows={1}
                />
            </div>

            {/* Send Button */}
            <button 
                onClick={handleSend}
                disabled={isLoading || (!inputText && files.length === 0)}
                className="p-3 rounded-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
            >
                🚀
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
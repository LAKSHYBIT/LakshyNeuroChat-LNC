import React, { useEffect, useRef, useState } from 'react';
import { getLiveClient } from '../services/geminiService';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';
import { Modality, LiveServerMessage } from '@google/genai';

const LiveSession: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(10).fill(10));
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Audio Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<Promise<any> | null>(null);

  // Video Streaming Interval
  const frameIntervalRef = useRef<number | null>(null);

  const startSession = async () => {
    try {
      setError(null);
      const ai = getLiveClient();
      
      // Setup Audio Contexts
      inputContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      outputContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;

      // Get User Media (Audio + Video for Multimodal)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;

      // Setup Video Preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Initialize Connection
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            
            // Start Audio Stream
            if (!inputContextRef.current) return;
            const source = inputContextRef.current.createMediaStreamSource(stream);
            const scriptProcessor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
              
              // Fake visualizer update based on volume
              const volume = inputData.reduce((a, b) => a + Math.abs(b), 0) / inputData.length;
              setVisualizerData(prev => prev.map(() => Math.random() * 20 + (volume * 500)));
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputContextRef.current.destination);

            // Start Video Stream
            startVideoStreaming(sessionPromise);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputContextRef.current) {
               const ctx = outputContextRef.current;
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               
               const audioBuffer = await decodeAudioData(
                 decode(base64Audio),
                 ctx,
                 24000,
                 1
               );
               
               const source = ctx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(ctx.destination);
               source.addEventListener('ended', () => {
                 sourcesRef.current.delete(source);
               });
               
               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += audioBuffer.duration;
               sourcesRef.current.add(source);
            }

            // Handle Interruption
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            setIsConnected(false);
          },
          onerror: (e) => {
            console.error("Live API Error", e);
            setError("Connection error.");
            setIsConnected(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: "You are a helpful, witty AI assistant named Nano-Banana. Be concise.",
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error(err);
      setError("Failed to access media devices or connect.");
    }
  };

  const startVideoStreaming = (sessionPromise: Promise<any>) => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    const video = videoRef.current;
    
    frameIntervalRef.current = window.setInterval(() => {
      if (!ctx || !video) return;
      canvasRef.current!.width = video.videoWidth * 0.2; // downscale for speed
      canvasRef.current!.height = video.videoHeight * 0.2;
      ctx.drawImage(video, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
      
      canvasRef.current!.toBlob(async (blob) => {
        if (!blob) return;
        
        // Convert Blob to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
           sessionPromise.then(session => {
             session.sendRealtimeInput({
               media: { data: base64data, mimeType: 'image/jpeg' }
             });
           });
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.5);
    }, 1000); // 1 FPS for efficiency
  };

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.then(s => s.close());
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (inputContextRef.current) inputContextRef.current.close();
    if (outputContextRef.current) outputContextRef.current.close();
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    
    setIsConnected(false);
    sessionRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 animate-fade-in">
      <div className="relative w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
        <video ref={videoRef} className="w-full h-full object-cover opacity-80" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Overlay UI */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {!isConnected && (
            <div className="bg-black/80 backdrop-blur-md p-6 rounded-xl border border-gray-700 text-center pointer-events-auto">
               <div className="text-4xl mb-4">🎙️</div>
               <h2 className="text-xl font-bold text-white mb-2">Gemini Live</h2>
               <p className="text-gray-400 mb-6 max-w-xs">Real-time voice and video conversation powered by Gemini 2.5.</p>
               <button 
                 onClick={startSession}
                 className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95"
               >
                 Start Conversation
               </button>
            </div>
          )}
          
          {error && (
            <div className="absolute top-4 bg-red-500/90 text-white px-4 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Visualizer when connected */}
        {isConnected && (
          <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-black via-black/50 to-transparent flex items-end justify-center gap-1 pb-8">
             {visualizerData.map((h, i) => (
               <div 
                 key={i} 
                 className="w-3 bg-yellow-400 rounded-t-full transition-all duration-75"
                 style={{ height: `${Math.max(10, h)}px` }}
               />
             ))}
          </div>
        )}
      </div>

      {isConnected && (
         <button 
           onClick={stopSession}
           className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full shadow-lg transition-transform hover:scale-105"
         >
           End Call
         </button>
      )}
    </div>
  );
};

export default LiveSession;
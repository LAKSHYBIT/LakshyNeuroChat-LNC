import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import LiveSession from './components/LiveSession';
import { AppMode } from './types';

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.CHAT);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      <Sidebar 
        currentMode={mode} 
        setMode={setMode} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <main className="flex-1 flex flex-col h-full relative">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center p-4 border-b border-gray-800 bg-gray-900 z-10">
          <button onClick={() => setIsSidebarOpen(true)} className="text-2xl mr-4">☰</button>
          <span className="font-bold text-yellow-500">Nano-Banana</span>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {mode === AppMode.LIVE ? (
            <LiveSession />
          ) : (
            <ChatInterface mode={mode === AppMode.CHAT ? 'CHAT' : mode === AppMode.IMAGE_GEN ? 'IMAGE_GEN' : 'VIDEO_GEN'} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
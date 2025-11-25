import React from 'react';
import { AppMode } from '../types';

interface SidebarProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentMode, setMode, isOpen, setIsOpen }) => {
  const modes = [
    { id: AppMode.CHAT, icon: '💬', label: 'Ultra Chat' },
    { id: AppMode.IMAGE_GEN, icon: '🎨', label: 'Nano Banana Image' },
    { id: AppMode.VIDEO_GEN, icon: '🎬', label: 'Veo Video' },
    { id: AppMode.LIVE, icon: '🎙️', label: 'Live Conversation' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className={`fixed md:relative z-30 w-64 h-full bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
            Nano-Banana
          </h1>
          <p className="text-xs text-gray-400 mt-1">Powered by Gemini 2.5 & 3.0</p>
        </div>

        <nav className="p-4 space-y-2">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                setMode(mode.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                currentMode === mode.id
                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-xl">{mode.icon}</span>
              <span className="font-medium">{mode.label}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-800">
            <div className="text-xs text-gray-500 text-center">
                Built with Google GenAI SDK
            </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
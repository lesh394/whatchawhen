import React from 'react';
import { X, HelpCircle } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  title,
  icon = 'ℹ️',
  subtitle,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn select-none"
      onClick={onClose}
    >
      <div 
        className="relative max-w-md w-full pixel-wood-frame rounded p-5 shadow-2xl text-[#ffebc4]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#542813] pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <h3 className="font-pixel-title text-xs sm:text-sm text-[#ffe599]">
                {title}
              </h3>
              {subtitle && (
                <div className="text-[9px] font-pixel-ui text-[#d7974e]">
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 bg-[#261106] border border-[#a47648] text-[#ffe2a0] hover:text-white rounded pixel-btn cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="font-pixel-body text-xs text-[#eed0ae] leading-relaxed space-y-2 mb-4">
          {children}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2 bg-[#5c993d] hover:bg-[#6ab346] border-2 border-[#2b4c1a] text-white font-pixel-title text-[10px] rounded pixel-btn shadow cursor-pointer"
        >
          GOT IT!
        </button>
      </div>
    </div>
  );
};

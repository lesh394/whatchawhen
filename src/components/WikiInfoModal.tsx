import React from 'react';
import { X, ExternalLink, BookOpen } from 'lucide-react';
import { CulturalItem } from '../types';

interface WikiInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CulturalItem;
  wikiExtract?: string;
  wikiUrl?: string;
}

export const WikiInfoModal: React.FC<WikiInfoModalProps> = ({
  isOpen,
  onClose,
  item,
  wikiExtract,
  wikiUrl,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fadeIn select-none"
      onClick={onClose}
    >
      <div 
        className="relative max-w-lg w-full pixel-parchment rounded p-5 shadow-2xl text-[#3b1d0d] overflow-y-auto max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#a47648]/60 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📜</span>
            <div>
              <h3 className="font-pixel-title text-xs sm:text-sm text-[#5e2b0d]">
                WIKIPEDIA ARCHIVE
              </h3>
              <div className="text-[9px] font-pixel-ui text-[#804a23]">
                {item.title} ({item.year}) • by {item.creator}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 bg-[#442211] border border-[#a47648] text-amber-200 hover:text-white rounded pixel-btn cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Encyclopedic Extract */}
        <div className="font-pixel-body text-xs leading-relaxed text-[#2d1407] space-y-3 mb-4">
          <p className="bg-[#dfb882]/40 p-3 rounded border border-[#ba8e59]/50">
            {wikiExtract || item.wikiExtract || item.trivia}
          </p>

          {/* Fun Fact / Trivia */}
          {item.trivia && (
            <div className="p-2.5 bg-[#caa06d]/40 border border-[#a47648]/60 rounded text-[11px]">
              <strong className="font-pixel-title text-[9px] text-[#5e2b0d] block mb-1">
                💡 CULTURAL TRIVIA:
              </strong>
              <span>{item.trivia}</span>
            </div>
          )}

          <div className="text-[10px] font-pixel-ui text-[#663814] italic">
            Movement / Genre: {item.genreOrMovement} • Type: {item.itemType}
          </div>
        </div>

        {/* Read more on Wikipedia Link & Close */}
        <div className="flex items-center justify-between pt-2 border-t border-[#a47648]/40">
          {wikiUrl ? (
            <a
              href={wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#442211] hover:bg-[#5e3218] border border-[#2b1308] text-amber-200 font-pixel-title text-[9px] rounded pixel-btn flex items-center gap-1.5 cursor-pointer shadow"
            >
              <span>READ ON WIKIPEDIA</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#5c993d] hover:bg-[#6ab346] border border-[#2b4c1a] text-white font-pixel-title text-[9px] rounded pixel-btn shadow cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

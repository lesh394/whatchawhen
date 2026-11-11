import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  altText: string;
  category: string;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  altText,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  if (!isOpen) return null;

  const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 4));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.5, 1));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn"
      onClick={onClose}
    >
      {/* Controls Bar */}
      <div 
        className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-slate-900/80 border border-slate-700/80 rounded-full px-3 py-1.5 backdrop-blur-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handleZoomIn}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          title="Reset Zoom"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-700 mx-1" />
        <button
          onClick={onClose}
          className="p-1.5 text-slate-300 hover:text-rose-400 hover:bg-slate-800 rounded-full transition-colors"
          title="Close Inspector"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div 
        className="relative max-w-5xl max-h-[90vh] overflow-hidden rounded-xl flex items-center justify-center select-none"
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <img
          src={imageUrl}
          alt={altText}
          className="max-h-[85vh] max-w-[90vw] object-contain transition-transform duration-100 ease-out rounded-lg shadow-2xl"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
          }}
          draggable={false}
        />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-slate-400 bg-slate-900/70 border border-slate-800 px-3 py-1 rounded-full pointer-events-none">
        {scale > 1 ? 'Drag to pan • Click outside to close' : 'Click buttons or scroll to zoom in and inspect details'}
      </div>
    </div>
  );
};

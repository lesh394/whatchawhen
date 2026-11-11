import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  altText: string;
  category: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clampPan(pos: { x: number; y: number }, scale: number): { x: number; y: number } {
  if (scale <= 1) return { x: 0, y: 0 };
  const maxOffset = Math.max(180, (scale - 1) * 320);
  return {
    x: Math.max(-maxOffset, Math.min(maxOffset, pos.x)),
    y: Math.max(-maxOffset, Math.min(maxOffset, pos.y)),
  };
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  altText,
}) => {
  if (!isOpen) return null;

  return (
    <ImageZoomModalInner
      key={imageUrl}
      onClose={onClose}
      imageUrl={imageUrl}
      altText={altText}
    />
  );
};

interface ImageZoomModalInnerProps {
  onClose: () => void;
  imageUrl: string;
  altText: string;
}

const ImageZoomModalInner: React.FC<ImageZoomModalInnerProps> = ({
  onClose,
  imageUrl,
  altText,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panOriginRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number } | null>(null);
  const pinchStartRef = useRef<{ dist: number; scale: number } | null>(null);
  const movedRef = useRef<boolean>(false);
  const lastTapTimeRef = useRef<number>(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.35 : -0.35;
      setScale(prevScale => {
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number((prevScale + delta).toFixed(2))));
        setPosition(prevPos => clampPan(prevPos, next));
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const updateScale = (nextRaw: number) => {
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(nextRaw.toFixed(2))));
    setScale(next);
    setPosition(prev => clampPan(prev, next));
  };

  const handleZoomIn = () => updateScale(scale + 0.5);
  const handleZoomOut = () => updateScale(scale - 0.5);
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    movedRef.current = false;

    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchStartRef.current = { dist: Math.max(1, dist), scale };
      panOriginRef.current = null;
      setIsDragging(false);
      setIsPinching(true);
    } else if (pointersRef.current.size === 1) {
      setIsDragging(true);
      setIsPinching(false);
      panOriginRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        posX: position.x,
        posY: position.y,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      movedRef.current = true;
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const nextScale = pinchStartRef.current.scale * (dist / pinchStartRef.current.dist);
      updateScale(nextScale);
      return;
    }

    if (pointersRef.current.size === 1 && panOriginRef.current) {
      const dx = e.clientX - panOriginRef.current.pointerX;
      const dy = e.clientY - panOriginRef.current.pointerY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        movedRef.current = true;
      }
      if (scale > 1) {
        setPosition(
          clampPan(
            {
              x: panOriginRef.current.posX + dx,
              y: panOriginRef.current.posY + dy,
            },
            scale
          )
        );
      }
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size === 1) {
      const [remaining] = Array.from(pointersRef.current.values());
      pinchStartRef.current = null;
      panOriginRef.current = {
        pointerX: remaining.x,
        pointerY: remaining.y,
        posX: position.x,
        posY: position.y,
      };
      setIsDragging(true);
      setIsPinching(false);
      return;
    }

    pinchStartRef.current = null;
    panOriginRef.current = null;
    setIsDragging(false);
    setIsPinching(false);

    // Double-tap / double-click zoom toggle when finger didn't drag
    if (e.type === 'pointerup' && !movedRef.current) {
      const now = Date.now();
      if (now - lastTapTimeRef.current < 280) {
        lastTapTimeRef.current = 0;
        if (scale > 1) {
          handleReset();
        } else {
          updateScale(2.5);
        }
      } else {
        lastTapTimeRef.current = now;
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 sm:bg-black/90 sm:backdrop-blur-md p-3 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      {/* Controls Bar */}
      <div
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-10 flex items-center gap-1 sm:gap-2 bg-slate-900/90 border border-slate-700/80 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-2 sm:p-1.5 text-slate-200 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          title="Zoom In"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <span className="text-[11px] font-mono text-amber-300 px-1 min-w-[36px] text-center tabular-nums">
          {scale.toFixed(1)}x
        </span>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-2 sm:p-1.5 text-slate-200 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="p-2 sm:p-1.5 text-slate-200 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          title="Reset Zoom"
          aria-label="Reset zoom"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-700 mx-0.5 sm:mx-1" />
        <button
          type="button"
          onClick={onClose}
          className="p-2 sm:p-1.5 text-slate-200 hover:text-rose-400 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          title="Close Inspector"
          aria-label="Close zoom inspector"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        ref={stageRef}
        className="relative max-w-5xl max-h-[82dvh] sm:max-h-[88dvh] overflow-hidden rounded-xl flex items-center justify-center select-none touch-none"
        onClick={e => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        style={{
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          touchAction: 'none',
        }}
      >
        <img
          src={imageUrl}
          alt={altText}
          decoding="async"
          className="max-h-[78dvh] sm:max-h-[85dvh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
          style={{
            imageRendering: 'auto',
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transition: isDragging || isPinching ? 'none' : 'transform 120ms ease-out',
            willChange: 'transform',
          }}
          draggable={false}
        />
      </div>

      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 max-w-[92vw] text-center text-[10px] sm:text-xs leading-tight text-slate-300 bg-slate-900/85 border border-slate-700 px-3 py-1.5 rounded-full pointer-events-none">
        {scale > 1
          ? 'Drag to pan • Double-tap to reset • Tap outside to close'
          : 'Pinch or double-tap to zoom • Tap outside to close'}
      </div>
    </div>
  );
};

import React, { useRef, useEffect, useState } from 'react';

interface PixelCoverProps {
  imageUrl: string;
  altText: string;
  className?: string;
  pixelWidth?: number; // target horizontal pixel resolution
  placeholderIcon?: string;
  placeholderBgClass?: string;
}

export const PixelCover: React.FC<PixelCoverProps> = ({
  imageUrl,
  altText,
  className = '',
  pixelWidth = 34,
  placeholderIcon = '📖',
  placeholderBgClass = 'bg-[#1f0f07]',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCanvasDrawn, setIsCanvasDrawn] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setIsCanvasDrawn(false);
    setHasError(false);

    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      if (isCancelled || !canvas) return;

      const aspectRatio = img.naturalHeight / (img.naturalWidth || 1);
      const lowWidth = pixelWidth;
      const lowHeight = Math.max(1, Math.round(pixelWidth * aspectRatio));

      canvas.width = lowWidth;
      canvas.height = lowHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, lowWidth, lowHeight);
      setIsCanvasDrawn(true);
    };

    img.onerror = () => {
      if (!isCancelled) {
        setIsCanvasDrawn(false);
        setHasError(true);
      }
    };

    return () => {
      isCancelled = true;
    };
  }, [imageUrl, pixelWidth]);

  return (
    <div className={`relative w-full h-full overflow-hidden select-none flex items-center justify-center ${className}`}>
      {/* 1. Loading Shimmer (prevents unpixelated cover flash) */}
      {!isCanvasDrawn && !hasError && (
        <div className={`absolute inset-0 ${placeholderBgClass} animate-pulse rounded flex items-center justify-center`}>
          <span className="text-2xl opacity-50">{placeholderIcon}</span>
        </div>
      )}

      {/* 2. Fine-Grained 2D Pixelated Canvas */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-contain pointer-events-none select-none transition-opacity duration-200 ${
          isCanvasDrawn ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          imageRendering: 'pixelated',
        }}
      />

      {/* 3. Fallback CSS Mosaic (only if CORS/network blocks canvas load) */}
      {hasError && !isCanvasDrawn && (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <img
            src={imageUrl}
            alt={altText}
            decoding="async"
            className="w-full h-full object-contain pointer-events-none select-none"
            style={{
              filter: 'blur(4px) contrast(1.2)',
              imageRendering: 'pixelated',
            }}
          />
        </div>
      )}
    </div>
  );
};

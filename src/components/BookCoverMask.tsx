import React from 'react';

interface BookCoverMaskProps {
  isRevealed?: boolean;
}

export const BookCoverMask: React.FC<BookCoverMaskProps> = ({ isRevealed = false }) => {
  if (isRevealed) return null;

  return (
    <div
      className="absolute inset-0 select-none z-20"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    />
  );
};

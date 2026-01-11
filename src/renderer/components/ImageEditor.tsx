import { useState, useEffect, useMemo } from 'react';
import type { ImageEdit } from '../types';

interface ImageEditorProps {
  image: ImageEdit;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<ImageEdit>) => void;
}

export function ImageEditor({
  image,
  scale,
  isSelected,
  onSelect,
  onUpdate,
}: ImageEditorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialSize, setInitialSize] = useState({ width: 0, height: 0 });

  // Create object URL for image data
  const imageUrl = useMemo(() => {
    const blob = new Blob([image.data], {
      type: image.type === 'png' ? 'image/png' : 'image/jpeg',
    });
    return URL.createObjectURL(blob);
  }, [image.data, image.type]);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - image.x * scale,
      y: e.clientY - image.y * scale,
    });
  };

  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    setIsResizing(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialSize({ width: image.width, height: image.height });
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = (e.clientX - dragStart.x) / scale;
        const newY = (e.clientY - dragStart.y) / scale;
        onUpdate({ x: Math.max(0, newX), y: Math.max(0, newY) });
      } else if (isResizing) {
        const dx = (e.clientX - dragStart.x) / scale;
        const dy = (e.clientY - dragStart.y) / scale;

        let newWidth = initialSize.width;
        let newHeight = initialSize.height;
        let newX = image.x;
        let newY = image.y;

        if (isResizing.includes('e')) {
          newWidth = Math.max(50, initialSize.width + dx);
        }
        if (isResizing.includes('w')) {
          newWidth = Math.max(50, initialSize.width - dx);
          newX = image.x + (initialSize.width - newWidth);
        }
        if (isResizing.includes('s')) {
          newHeight = Math.max(50, initialSize.height + dy);
        }
        if (isResizing.includes('n')) {
          newHeight = Math.max(50, initialSize.height - dy);
          newY = image.y + (initialSize.height - newHeight);
        }

        onUpdate({ width: newWidth, height: newHeight, x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, scale, onUpdate, initialSize, image.x, image.y]);

  return (
    <div
      className={`image-overlay ${isSelected ? 'selected' : ''}`}
      style={{
        left: image.x * scale,
        top: image.y * scale,
        width: image.width * scale,
        height: image.height * scale,
      }}
      onMouseDown={handleMouseDown}
    >
      <img
        src={imageUrl}
        alt="Added image"
        className="w-full h-full object-contain pointer-events-none"
        draggable={false}
      />

      {isSelected && (
        <>
          <div
            className="resize-handle nw"
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
          />
          <div
            className="resize-handle ne"
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
          />
          <div
            className="resize-handle sw"
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
          />
          <div
            className="resize-handle se"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          />
        </>
      )}
    </div>
  );
}

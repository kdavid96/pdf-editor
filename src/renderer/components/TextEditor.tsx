import { useState, useRef, useEffect } from 'react';
import type { TextEdit } from '../types';

interface TextEditorProps {
  textEdit: TextEdit;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<TextEdit>) => void;
}

export function TextEditor({
  textEdit,
  scale,
  isSelected,
  onSelect,
  onUpdate,
}: TextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localText, setLocalText] = useState(textEdit.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setLocalText(textEdit.text);
  }, [textEdit.text]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (localText !== textEdit.text) {
      onUpdate({ text: localText });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    e.preventDefault();
    onSelect();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - textEdit.x * scale,
      y: e.clientY - textEdit.y * scale,
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = (e.clientX - dragStart.x) / scale;
      const newY = (e.clientY - dragStart.y) / scale;
      onUpdate({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, scale, onUpdate]);

  return (
    <div
      className={`absolute ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{
        left: textEdit.x * scale,
        top: textEdit.y * scale,
        width: textEdit.width * scale,
        minHeight: textEdit.height * scale,
        cursor: isEditing ? 'text' : 'move',
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={handleBlur}
          className="text-edit-overlay w-full h-full"
          style={{
            fontSize: textEdit.fontSize * scale,
            fontFamily: textEdit.fontFamily,
            color: textEdit.color,
          }}
        />
      ) : (
        <div
          className="whitespace-pre-wrap break-words"
          style={{
            fontSize: textEdit.fontSize * scale,
            fontFamily: textEdit.fontFamily,
            color: textEdit.color,
            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            padding: '2px',
          }}
        >
          {textEdit.text || 'Double-click to edit'}
        </div>
      )}
    </div>
  );
}

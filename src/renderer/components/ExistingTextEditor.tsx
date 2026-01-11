import { useState, useRef, useEffect } from 'react';
import type { ExistingTextItem, TextModification } from '../types';

interface ExistingTextEditorProps {
  textItem: ExistingTextItem;
  modification: TextModification | undefined;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  onModify: (newText: string) => void;
  onDelete: () => void;
  onRestore: () => void;
  forceEdit?: boolean;
  onEditingComplete?: () => void;
}

export function ExistingTextEditor({
  textItem,
  modification,
  scale,
  isSelected,
  onSelect,
  onModify,
  onDelete,
  onRestore,
  forceEdit,
  onEditingComplete,
}: ExistingTextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localText, setLocalText] = useState(
    modification?.newText ?? textItem.text
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const isDeleted = modification?.deleted ?? false;
  const isModified = modification && !isDeleted && modification.newText !== textItem.text;

  useEffect(() => {
    if (!modification) {
      setLocalText(textItem.text);
    } else if (!modification.deleted) {
      setLocalText(modification.newText);
    }
  }, [textItem.text, modification]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle forced edit from toolbar button
  useEffect(() => {
    if (forceEdit && !isDeleted) {
      setIsEditing(true);
    }
  }, [forceEdit, isDeleted]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDeleted) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (localText !== textItem.text && localText !== modification?.newText) {
      onModify(localText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setLocalText(modification?.newText ?? textItem.text);
      setIsEditing(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <div
      className={`existing-content-editor ${isSelected ? 'selected' : ''} ${isDeleted ? 'deleted' : ''} ${isModified ? 'modified' : ''}`}
      style={{
        left: textItem.x * scale,
        top: textItem.y * scale,
        width: Math.max(textItem.width * scale, 20),
        height: Math.max(textItem.height * scale, 16),
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Clickable overlay */}
      <div className="edit-overlay absolute inset-0" />

      {/* Edit input */}
      {isEditing && !isDeleted && (
        <input
          ref={inputRef}
          type="text"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="absolute inset-0 bg-white border-2 border-blue-500 px-1 outline-none z-20"
          style={{
            fontSize: Math.max(textItem.fontSize * scale, 12),
            fontFamily: 'sans-serif',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Show modified text visibly when not editing */}
      {!isEditing && modification && !isDeleted && modification.newText !== textItem.text && (
        <div
          className="absolute inset-0 flex items-center bg-yellow-100 border border-yellow-400 z-10 px-1 overflow-hidden"
          style={{
            fontSize: Math.max(textItem.fontSize * scale, 10),
            fontFamily: 'sans-serif',
          }}
        >
          <span className="text-black whitespace-nowrap">{modification.newText}</span>
        </div>
      )}

      {/* Deleted overlay */}
      {isDeleted && (
        <div className="absolute inset-0 flex items-center bg-red-200 border-2 border-red-500 z-10 px-1">
          <span
            className="text-red-700 line-through whitespace-nowrap overflow-hidden"
            style={{
              fontSize: Math.max(textItem.fontSize * scale * 0.9, 10),
            }}
          >
            {textItem.text}
          </span>
        </div>
      )}

      {/* Action buttons */}
      {isSelected && (
        <div className="absolute -top-8 left-0 flex gap-1 bg-white shadow-lg rounded px-1 py-0.5 z-30 border border-gray-200">
          {isDeleted ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              className="px-2 py-0.5 text-xs bg-green-500 text-white rounded hover:bg-green-600"
            >
              Restore
            </button>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Modified indicator */}
      {modification && !isDeleted && modification.newText !== textItem.text && (
        <div className="absolute -right-1 -top-1 w-3 h-3 bg-orange-500 rounded-full z-10" title="Modified" />
      )}
    </div>
  );
}

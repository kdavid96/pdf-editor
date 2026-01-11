import type { ExistingImageItem } from '../types';

interface ExistingImageEditorProps {
  imageItem: ExistingImageItem;
  scale: number;
  isDeleted: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRestore: () => void;
}

export function ExistingImageEditor({
  imageItem,
  scale,
  isDeleted,
  isSelected,
  onSelect,
  onDelete,
  onRestore,
}: ExistingImageEditorProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <div
      className={`existing-content-editor ${isSelected ? 'selected' : ''} ${isDeleted ? 'deleted' : ''}`}
      style={{
        left: imageItem.x * scale,
        top: imageItem.y * scale,
        width: imageItem.width * scale,
        height: imageItem.height * scale,
      }}
      onClick={handleClick}
    >
      {/* Clickable overlay */}
      <div className="edit-overlay absolute inset-0" />

      {/* Deleted indicator */}
      {isDeleted && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/50 z-10">
          <div className="bg-red-600 text-white px-3 py-1 rounded text-sm font-medium shadow-lg">
            DELETED
          </div>
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

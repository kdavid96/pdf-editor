import type { Tool } from '../types';

interface ToolbarProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  scale: number;
  onScaleChange: (scale: number) => void;
  toolColor: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  onAddImage: () => void;
  hasDocument: boolean;
  fileName: string;
  onFileNameChange: (name: string) => void;
  hasSelection: boolean;
  onDeleteSelected: () => void;
  onEditSelected: () => void;
  selectedType: string | null;
}

const tools: { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'highlight', label: 'Highlight', icon: '🖍' },
  { id: 'comment', label: 'Comment', icon: '💬' },
  { id: 'draw', label: 'Draw', icon: '✏' },
  { id: 'shape-rectangle', label: 'Rectangle', icon: '▢' },
  { id: 'shape-circle', label: 'Circle', icon: '○' },
  { id: 'shape-arrow', label: 'Arrow', icon: '→' },
  { id: 'shape-line', label: 'Line', icon: '/' },
];

const colors = [
  '#ffff00', // Yellow
  '#ff0000', // Red
  '#00ff00', // Green
  '#0000ff', // Blue
  '#ff00ff', // Magenta
  '#00ffff', // Cyan
  '#ff9900', // Orange
  '#000000', // Black
];

export function Toolbar({
  currentTool,
  onToolChange,
  onOpenFile,
  onSave,
  onSaveAs,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  scale,
  onScaleChange,
  toolColor,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onAddImage,
  hasDocument,
  fileName,
  onFileNameChange,
  hasSelection,
  onDeleteSelected,
  onEditSelected,
  selectedType,
}: ToolbarProps) {
  return (
    <div className="bg-gray-800 text-white px-4 py-2 flex items-center gap-4 flex-wrap">
      {/* File operations */}
      <div className="flex items-center gap-1">
        <button
          onClick={onOpenFile}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
        >
          Open
        </button>
        <button
          onClick={onSave}
          disabled={!hasDocument}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium"
        >
          Save
        </button>
        <button
          onClick={onSaveAs}
          disabled={!hasDocument}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium"
        >
          Save As
        </button>
      </div>

      {/* File name input */}
      {hasDocument && (
        <>
          <div className="w-px h-6 bg-gray-600" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">File:</span>
            <input
              type="text"
              value={fileName}
              onChange={(e) => onFileNameChange(e.target.value)}
              className="bg-gray-700 px-2 py-1 rounded text-sm w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="filename.pdf"
            />
          </div>
        </>
      )}

      <div className="w-px h-6 bg-gray-600" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="px-2 py-1.5 hover:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded"
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="px-2 py-1.5 hover:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded"
          title="Redo (Ctrl+Y)"
        >
          ↷
        </button>
      </div>

      {/* Edit/Delete - shown when element is selected */}
      {hasSelection && (
        <>
          <div className="w-px h-6 bg-gray-600" />
          <div className="flex items-center gap-1">
            {selectedType === 'text' && (
              <button
                onClick={onEditSelected}
                className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-medium"
                title="Edit selected element"
              >
                Edit
              </button>
            )}
            <button
              onClick={onDeleteSelected}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium"
              title="Delete selected element (Del)"
            >
              Delete
            </button>
            <span className="text-xs text-gray-400 ml-1">
              {selectedType}
            </span>
          </div>
        </>
      )}

      <div className="w-px h-6 bg-gray-600" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          disabled={!hasDocument}
          className="px-2 py-1.5 hover:bg-gray-700 disabled:text-gray-500 rounded"
        >
          −
        </button>
        <select
          value={scale}
          onChange={(e) => onScaleChange(parseFloat(e.target.value))}
          disabled={!hasDocument}
          className="bg-gray-700 px-2 py-1 rounded text-sm disabled:bg-gray-600"
        >
          <option value={0.5}>50%</option>
          <option value={0.75}>75%</option>
          <option value={1}>100%</option>
          <option value={1.25}>125%</option>
          <option value={1.5}>150%</option>
          <option value={2}>200%</option>
        </select>
        <button
          onClick={onZoomIn}
          disabled={!hasDocument}
          className="px-2 py-1.5 hover:bg-gray-700 disabled:text-gray-500 rounded"
        >
          +
        </button>
      </div>

      <div className="w-px h-6 bg-gray-600" />

      {/* Tools */}
      <div className="flex items-center gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            disabled={!hasDocument}
            className={`px-2 py-1.5 rounded text-sm ${
              currentTool === tool.id
                ? 'bg-blue-600'
                : 'hover:bg-gray-700 disabled:text-gray-500'
            }`}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
        <button
          onClick={onAddImage}
          disabled={!hasDocument}
          className="px-2 py-1.5 hover:bg-gray-700 disabled:text-gray-500 rounded text-sm"
          title="Add Image"
        >
          🖼
        </button>
      </div>

      <div className="w-px h-6 bg-gray-600" />

      {/* Color picker */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400">Color:</span>
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={`w-5 h-5 rounded border-2 ${
              toolColor === color ? 'border-white' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      {/* Stroke width */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Width:</span>
        <input
          type="range"
          min="1"
          max="10"
          value={strokeWidth}
          onChange={(e) => onStrokeWidthChange(parseInt(e.target.value))}
          className="w-20"
        />
        <span className="text-xs w-4">{strokeWidth}</span>
      </div>
    </div>
  );
}

import { useRef, useState, useEffect, useCallback } from 'react';
import type {
  Tool,
  TextEdit,
  Highlight,
  Comment,
  DrawingPath,
  Shape,
} from '../types';

interface AnnotationLayerProps {
  pageIndex: number;
  width: number;
  height: number;
  scale: number;
  currentTool: Tool;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  toolColor: string;
  strokeWidth: number;
  highlights: Highlight[];
  comments: Comment[];
  drawings: DrawingPath[];
  shapes: Shape[];
  onAddTextEdit: (edit: Omit<TextEdit, 'id' | 'pageIndex'>) => string;
  onAddHighlight: (highlight: Omit<Highlight, 'id' | 'pageIndex'>) => string;
  onAddComment: (comment: Omit<Comment, 'id' | 'pageIndex' | 'createdAt'>) => string;
  onUpdateComment: (id: string, text: string) => void;
  onAddDrawing: (drawing: Omit<DrawingPath, 'id' | 'pageIndex'>) => string;
  onAddShape: (shape: Omit<Shape, 'id' | 'pageIndex'>) => string;
  onUpdateShape: (id: string, updates: Partial<Shape>) => void;
}

export function AnnotationLayer({
  pageIndex,
  width,
  height,
  scale,
  currentTool,
  selectedId,
  onSelect,
  toolColor,
  strokeWidth,
  highlights,
  comments,
  drawings,
  shapes,
  onAddTextEdit,
  onAddHighlight,
  onAddComment,
  onUpdateComment,
  onAddDrawing,
  onAddShape,
}: AnnotationLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [tempShape, setTempShape] = useState<Omit<Shape, 'id' | 'pageIndex'> | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [highlightStart, setHighlightStart] = useState<{ x: number; y: number } | null>(null);
  const [tempHighlight, setTempHighlight] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const getCoordinates = useCallback(
    (e: React.MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };

      const rect = svg.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    },
    [scale]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const coords = getCoordinates(e);

    if (currentTool === 'text') {
      onAddTextEdit({
        x: coords.x,
        y: coords.y,
        width: 200,
        height: 30,
        text: '',
        fontSize: 14,
        fontFamily: 'Arial',
        color: toolColor,
      });
    } else if (currentTool === 'comment') {
      const id = onAddComment({
        x: coords.x,
        y: coords.y,
        text: '',
      });
      setEditingCommentId(id);
    } else if (currentTool === 'draw') {
      setIsDrawing(true);
      setCurrentPath([coords]);
    } else if (currentTool === 'highlight') {
      setHighlightStart(coords);
      setTempHighlight({ x: coords.x, y: coords.y, width: 0, height: 0 });
    } else if (currentTool.startsWith('shape-')) {
      setShapeStart(coords);
      const shapeType = currentTool.replace('shape-', '') as Shape['type'];
      setTempShape({
        type: shapeType,
        x: coords.x,
        y: coords.y,
        width: 0,
        height: 0,
        color: toolColor,
        strokeWidth,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getCoordinates(e);

    if (isDrawing && currentTool === 'draw') {
      setCurrentPath((prev) => [...prev, coords]);
    } else if (highlightStart && currentTool === 'highlight') {
      setTempHighlight({
        x: Math.min(highlightStart.x, coords.x),
        y: Math.min(highlightStart.y, coords.y),
        width: Math.abs(coords.x - highlightStart.x),
        height: Math.abs(coords.y - highlightStart.y),
      });
    } else if (shapeStart && tempShape) {
      setTempShape((prev) =>
        prev
          ? {
              ...prev,
              x: Math.min(shapeStart.x, coords.x),
              y: Math.min(shapeStart.y, coords.y),
              width: Math.abs(coords.x - shapeStart.x),
              height: Math.abs(coords.y - shapeStart.y),
            }
          : null
      );
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentPath.length > 1) {
      onAddDrawing({
        points: currentPath,
        color: toolColor,
        width: strokeWidth,
      });
    }

    if (tempHighlight && tempHighlight.width > 5 && tempHighlight.height > 5) {
      onAddHighlight({
        rects: [tempHighlight],
        color: toolColor,
      });
    }

    if (tempShape && tempShape.width > 5 && tempShape.height > 5) {
      onAddShape(tempShape);
    }

    setIsDrawing(false);
    setCurrentPath([]);
    setHighlightStart(null);
    setTempHighlight(null);
    setShapeStart(null);
    setTempShape(null);
  };

  // Handle click outside to deselect
  useEffect(() => {
    const handleClickOutside = () => {
      if (editingCommentId) {
        setEditingCommentId(null);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [editingCommentId]);

  const pathToD = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * scale} ${p.y * scale}`)
      .join(' ');
  };

  const renderShape = (shape: Shape | (Omit<Shape, 'id' | 'pageIndex'> & { id?: string }), isTemp = false) => {
    const { type, x, y, width: w, height: h, color, strokeWidth: sw } = shape;
    const scaledX = x * scale;
    const scaledY = y * scale;
    const scaledW = w * scale;
    const scaledH = h * scale;
    const key = 'id' in shape && shape.id ? shape.id : 'temp';
    const isSelected = 'id' in shape && shape.id === selectedId;

    const commonProps = {
      stroke: color,
      strokeWidth: sw,
      fill: 'none',
      opacity: isTemp ? 0.5 : 1,
      cursor: 'pointer',
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        if ('id' in shape && shape.id) {
          onSelect(shape.id);
        }
      },
    };

    switch (type) {
      case 'rectangle':
        return (
          <rect
            key={key}
            x={scaledX}
            y={scaledY}
            width={scaledW}
            height={scaledH}
            {...commonProps}
            strokeDasharray={isSelected ? '5,5' : undefined}
          />
        );
      case 'circle':
        return (
          <ellipse
            key={key}
            cx={scaledX + scaledW / 2}
            cy={scaledY + scaledH / 2}
            rx={scaledW / 2}
            ry={scaledH / 2}
            {...commonProps}
            strokeDasharray={isSelected ? '5,5' : undefined}
          />
        );
      case 'arrow':
        const endX = scaledX + scaledW;
        const endY = scaledY + scaledH;
        const angle = Math.atan2(scaledH, scaledW);
        const headLen = 15;
        return (
          <g key={key} {...commonProps}>
            <line x1={scaledX} y1={scaledY} x2={endX} y2={endY} />
            <line
              x1={endX}
              y1={endY}
              x2={endX - headLen * Math.cos(angle - Math.PI / 6)}
              y2={endY - headLen * Math.sin(angle - Math.PI / 6)}
            />
            <line
              x1={endX}
              y1={endY}
              x2={endX - headLen * Math.cos(angle + Math.PI / 6)}
              y2={endY - headLen * Math.sin(angle + Math.PI / 6)}
            />
          </g>
        );
      case 'line':
        return (
          <line
            key={key}
            x1={scaledX}
            y1={scaledY}
            x2={scaledX + scaledW}
            y2={scaledY + scaledH}
            {...commonProps}
          />
        );
      default:
        return null;
    }
  };

  const isInteractive = currentTool !== 'select';

  return (
    <div
      className={`annotation-layer ${isInteractive ? 'interactive' : ''}`}
      style={{ width, height }}
    >
      {/* Highlights */}
      {highlights.map((highlight) => (
        <div key={highlight.id}>
          {highlight.rects.map((rect, i) => (
            <div
              key={i}
              className={`highlight ${selectedId === highlight.id ? 'ring-2 ring-blue-500' : ''}`}
              style={{
                left: rect.x * scale,
                top: rect.y * scale,
                width: rect.width * scale,
                height: rect.height * scale,
                backgroundColor: highlight.color,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(highlight.id);
              }}
            />
          ))}
        </div>
      ))}

      {/* Temp highlight */}
      {tempHighlight && (
        <div
          className="highlight"
          style={{
            left: tempHighlight.x * scale,
            top: tempHighlight.y * scale,
            width: tempHighlight.width * scale,
            height: tempHighlight.height * scale,
            backgroundColor: toolColor,
            opacity: 0.5,
          }}
        />
      )}

      {/* Comments */}
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="absolute"
          style={{
            left: comment.x * scale,
            top: comment.y * scale,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`comment-marker ${selectedId === comment.id ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => {
              onSelect(comment.id);
              setEditingCommentId(comment.id);
            }}
          >
            💬
          </div>
          {(editingCommentId === comment.id || comment.text) && (
            <div
              className="absolute left-8 top-0 bg-yellow-100 border border-yellow-300 rounded p-2 shadow-lg min-w-48 z-10"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {editingCommentId === comment.id ? (
                <textarea
                  autoFocus
                  className="w-full h-20 bg-transparent border-none outline-none resize-none text-sm"
                  value={comment.text}
                  onChange={(e) => onUpdateComment(comment.id, e.target.value)}
                  onBlur={() => setEditingCommentId(null)}
                  placeholder="Enter comment..."
                />
              ) : (
                <div
                  className="text-sm cursor-pointer"
                  onClick={() => setEditingCommentId(comment.id)}
                >
                  {comment.text}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* SVG for drawings and shapes */}
      <svg
        ref={svgRef}
        className={`drawing-canvas ${['draw', 'highlight', 'text', 'comment'].includes(currentTool) || currentTool.startsWith('shape-') ? 'active' : ''}`}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Existing drawings */}
        {drawings.map((drawing) => (
          <path
            key={drawing.id}
            d={pathToD(drawing.points)}
            stroke={drawing.color}
            strokeWidth={drawing.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={selectedId === drawing.id ? 'stroke-dasharray-[5,5]' : ''}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(drawing.id);
            }}
          />
        ))}

        {/* Current drawing path */}
        {isDrawing && currentPath.length > 0 && (
          <path
            d={pathToD(currentPath)}
            stroke={toolColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />
        )}

        {/* Existing shapes */}
        {shapes.map((shape) => renderShape(shape))}

        {/* Temp shape */}
        {tempShape && renderShape(tempShape, true)}
      </svg>
    </div>
  );
}

import { useEffect, useRef, useCallback, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import type {
  EditorState,
  Tool,
  TextEdit,
  Highlight,
  Comment,
  DrawingPath,
  Shape,
  ImageEdit,
  ExistingTextItem,
  ExistingImageItem,
} from '../types';
import { AnnotationLayer } from './AnnotationLayer';
import { TextEditor } from './TextEditor';
import { ImageEditor } from './ImageEditor';
import { ExistingTextEditor } from './ExistingTextEditor';
import { ExistingImageEditor } from './ExistingImageEditor';

interface PDFViewerProps {
  pages: PDFPageProxy[];
  scale: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  editorState: EditorState;
  currentTool: Tool;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  toolColor: string;
  strokeWidth: number;
  onAddTextEdit: (edit: Omit<TextEdit, 'id'>) => string;
  onUpdateTextEdit: (id: string, updates: Partial<TextEdit>) => void;
  onAddHighlight: (highlight: Omit<Highlight, 'id'>) => string;
  onAddComment: (comment: Omit<Comment, 'id' | 'createdAt'>) => string;
  onUpdateComment: (id: string, text: string) => void;
  onAddDrawing: (drawing: Omit<DrawingPath, 'id'>) => string;
  onAddShape: (shape: Omit<Shape, 'id'>) => string;
  onUpdateShape: (id: string, updates: Partial<Shape>) => void;
  onUpdateImage: (id: string, updates: Partial<ImageEdit>) => void;
  onModifyExistingText: (id: string, newText: string) => void;
  onDeleteExistingText: (id: string) => void;
  onRestoreExistingText: (id: string) => void;
  onDeleteExistingImage: (id: string) => void;
  onRestoreExistingImage: (id: string) => void;
  editingTextId: string | null;
  onEditingComplete: () => void;
}

interface PageViewProps {
  page: PDFPageProxy;
  pageIndex: number;
  scale: number;
  editorState: EditorState;
  currentTool: Tool;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  toolColor: string;
  strokeWidth: number;
  onAddTextEdit: (edit: Omit<TextEdit, 'id'>) => string;
  onUpdateTextEdit: (id: string, updates: Partial<TextEdit>) => void;
  onAddHighlight: (highlight: Omit<Highlight, 'id'>) => string;
  onAddComment: (comment: Omit<Comment, 'id' | 'createdAt'>) => string;
  onUpdateComment: (id: string, text: string) => void;
  onAddDrawing: (drawing: Omit<DrawingPath, 'id'>) => string;
  onAddShape: (shape: Omit<Shape, 'id'>) => string;
  onUpdateShape: (id: string, updates: Partial<Shape>) => void;
  onUpdateImage: (id: string, updates: Partial<ImageEdit>) => void;
  onModifyExistingText: (id: string, newText: string) => void;
  onDeleteExistingText: (id: string) => void;
  onRestoreExistingText: (id: string) => void;
  onDeleteExistingImage: (id: string) => void;
  onRestoreExistingImage: (id: string) => void;
  editingTextId: string | null;
  onEditingComplete: () => void;
}

function PageView({
  page,
  pageIndex,
  scale,
  editorState,
  currentTool,
  selectedId,
  onSelect,
  toolColor,
  strokeWidth,
  onAddTextEdit,
  onUpdateTextEdit,
  onAddHighlight,
  onAddComment,
  onUpdateComment,
  onAddDrawing,
  onAddShape,
  onUpdateShape,
  onUpdateImage,
  onModifyExistingText,
  onDeleteExistingText,
  onRestoreExistingText,
  onDeleteExistingImage,
  onRestoreExistingImage,
  editingTextId,
  onEditingComplete,
}: PageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [existingTextItems, setExistingTextItems] = useState<ExistingTextItem[]>([]);
  const [existingImageItems, setExistingImageItems] = useState<ExistingImageItem[]>([]);

  // Area selection state
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Render PDF page
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (!context) return;

    const renderTask = page.render({
      canvasContext: context,
      viewport,
    });

    return () => {
      renderTask.cancel();
    };
  }, [page, scale]);

  // Extract existing text items
  useEffect(() => {
    let cancelled = false;

    async function extractText() {
      try {
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 });

        const items: ExistingTextItem[] = textContent.items
          .filter((item): item is typeof item & { str: string } => 'str' in item && item.str.trim() !== '')
          .map((item, index) => {
            const tx = item.transform;
            // PDF coordinates are bottom-left origin, we need to convert
            const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
            const x = tx[4];
            const y = viewport.height - tx[5] - fontSize;

            return {
              id: `text-${pageIndex}-${index}`,
              pageIndex,
              x,
              y,
              width: item.width || fontSize * item.str.length * 0.6,
              height: fontSize * 1.2,
              text: item.str,
              fontSize,
              fontName: item.fontName || 'unknown',
              transform: tx,
            };
          });

        if (!cancelled) {
          setExistingTextItems(items);
        }
      } catch (error) {
        console.error('Failed to extract text:', error);
      }
    }

    extractText();

    return () => {
      cancelled = true;
    };
  }, [page, pageIndex]);

  // Extract existing images
  useEffect(() => {
    let cancelled = false;

    async function extractImages() {
      try {
        const operatorList = await page.getOperatorList();
        const viewport = page.getViewport({ scale: 1 });
        const images: ExistingImageItem[] = [];

        // Track transform matrix
        let currentTransform = [1, 0, 0, 1, 0, 0];
        const transformStack: number[][] = [];

        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const fn = operatorList.fnArray[i];
          const args = operatorList.argsArray[i];

          // OPS.save = 10
          if (fn === 10) {
            transformStack.push([...currentTransform]);
          }
          // OPS.restore = 11
          else if (fn === 11) {
            currentTransform = transformStack.pop() || [1, 0, 0, 1, 0, 0];
          }
          // OPS.transform = 12
          else if (fn === 12) {
            const [a, b, c, d, e, f] = args as number[];
            const [a2, b2, c2, d2, e2, f2] = currentTransform;
            currentTransform = [
              a * a2 + b * c2,
              a * b2 + b * d2,
              c * a2 + d * c2,
              c * b2 + d * d2,
              e * a2 + f * c2 + e2,
              e * b2 + f * d2 + f2,
            ];
          }
          // OPS.paintImageXObject = 85, OPS.paintImageXObjectRepeat = 88
          else if (fn === 85 || fn === 88) {
            const objectId = args[0] as string;
            const [a, b, c, d, e, f] = currentTransform;

            // Calculate image dimensions and position
            const width = Math.sqrt(a * a + b * b);
            const height = Math.sqrt(c * c + d * d);
            const x = e;
            const y = viewport.height - f - height;

            if (width > 10 && height > 10) {
              images.push({
                id: `img-${pageIndex}-${images.length}`,
                pageIndex,
                x,
                y,
                width,
                height,
                objectId,
              });
            }
          }
        }

        if (!cancelled) {
          setExistingImageItems(images);
        }
      } catch (error) {
        console.error('Failed to extract images:', error);
      }
    }

    extractImages();

    return () => {
      cancelled = true;
    };
  }, [page, pageIndex]);

  const viewport = page.getViewport({ scale });

  // Get items for this page
  const pageTextEdits = editorState.textEdits.filter((e) => e.pageIndex === pageIndex);
  const pageImages = editorState.images.filter((e) => e.pageIndex === pageIndex);
  const pageHighlights = editorState.annotations.highlights.filter(
    (e) => e.pageIndex === pageIndex
  );
  const pageComments = editorState.annotations.comments.filter(
    (e) => e.pageIndex === pageIndex
  );
  const pageDrawings = editorState.annotations.drawings.filter(
    (e) => e.pageIndex === pageIndex
  );
  const pageShapes = editorState.annotations.shapes.filter(
    (e) => e.pageIndex === pageIndex
  );

  // Helper to check if a rect intersects with the selection
  const rectsIntersect = (
    r1: { x: number; y: number; width: number; height: number },
    r2: { x: number; y: number; width: number; height: number }
  ) => {
    return !(
      r1.x + r1.width < r2.x ||
      r2.x + r2.width < r1.x ||
      r1.y + r1.height < r2.y ||
      r2.y + r2.height < r1.y
    );
  };

  // Find first element within selection rectangle
  const findElementInSelection = (rect: { x: number; y: number; width: number; height: number }) => {
    console.log('Finding elements in selection:', rect);
    console.log('Existing text items:', existingTextItems.length);
    console.log('Existing image items:', existingImageItems.length);

    // Check existing text items
    for (const item of existingTextItems) {
      const itemRect = { x: item.x, y: item.y, width: item.width, height: item.height };
      if (rectsIntersect(rect, itemRect)) {
        console.log('Found text item:', item.id, itemRect);
        return item.id;
      }
    }
    // Check existing images
    for (const item of existingImageItems) {
      const itemRect = { x: item.x, y: item.y, width: item.width, height: item.height };
      if (rectsIntersect(rect, itemRect)) {
        console.log('Found image item:', item.id, itemRect);
        return item.id;
      }
    }
    // Check new text edits
    for (const item of pageTextEdits) {
      const itemRect = { x: item.x, y: item.y, width: item.width, height: item.height };
      if (rectsIntersect(rect, itemRect)) {
        console.log('Found text edit:', item.id, itemRect);
        return item.id;
      }
    }
    // Check new images
    for (const item of pageImages) {
      const itemRect = { x: item.x, y: item.y, width: item.width, height: item.height };
      if (rectsIntersect(rect, itemRect)) {
        console.log('Found image:', item.id, itemRect);
        return item.id;
      }
    }
    // Check shapes
    for (const item of pageShapes) {
      const itemRect = { x: item.x, y: item.y, width: item.width, height: item.height };
      if (rectsIntersect(rect, itemRect)) {
        console.log('Found shape:', item.id, itemRect);
        return item.id;
      }
    }
    // Check highlights
    for (const item of pageHighlights) {
      for (const r of item.rects) {
        if (rectsIntersect(rect, r)) {
          console.log('Found highlight:', item.id);
          return item.id;
        }
      }
    }
    console.log('No element found in selection');
    return null;
  };

  // Area selection handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (currentTool !== 'select') return;
    if (e.button !== 0) return;

    // Only start area selection if clicking on the background (canvas) or the page container
    const target = e.target as HTMLElement;
    const isOnCanvas = target.classList.contains('pdf-canvas');
    const isOnContainer = target.classList.contains('pdf-page-container');
    const isOnOverlay = target.classList.contains('area-selection-overlay');

    if (!isOnCanvas && !isOnContainer && !isOnOverlay) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    console.log('Starting area selection at:', { x, y });
    setSelectionStart({ x, y });
    setSelectionRect({ x, y, width: 0, height: 0 });
    onSelect(null); // Deselect when starting new selection
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectionStart || currentTool !== 'select') return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / scale;
    const currentY = (e.clientY - rect.top) / scale;

    setSelectionRect({
      x: Math.min(selectionStart.x, currentX),
      y: Math.min(selectionStart.y, currentY),
      width: Math.abs(currentX - selectionStart.x),
      height: Math.abs(currentY - selectionStart.y),
    });
  };

  const handleMouseUp = () => {
    if (selectionRect && selectionRect.width > 5 && selectionRect.height > 5) {
      const foundId = findElementInSelection(selectionRect);
      if (foundId) {
        onSelect(foundId);
      }
    }
    setSelectionStart(null);
    setSelectionRect(null);
  };

  return (
    <div
      ref={containerRef}
      className="pdf-page-container bg-white inline-block relative"
      style={{ width: viewport.width, height: viewport.height }}
      data-page-index={pageIndex}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} className="pdf-canvas" />

      {/* Area selection rectangle */}
      {selectionRect && selectionRect.width > 0 && selectionRect.height > 0 && (
        <div
          className="area-selection-overlay absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-50"
          style={{
            left: selectionRect.x * scale,
            top: selectionRect.y * scale,
            width: selectionRect.width * scale,
            height: selectionRect.height * scale,
          }}
        />
      )}

      {/* Existing text items (editable) */}
      {currentTool === 'select' && existingTextItems.map((textItem) => {
        const modification = editorState.textModifications.find((m) => m.id === textItem.id);
        return (
          <ExistingTextEditor
            key={textItem.id}
            textItem={textItem}
            modification={modification}
            scale={scale}
            isSelected={selectedId === textItem.id}
            onSelect={() => onSelect(textItem.id)}
            onModify={(newText) => onModifyExistingText(textItem.id, newText)}
            onDelete={() => onDeleteExistingText(textItem.id)}
            onRestore={() => onRestoreExistingText(textItem.id)}
            forceEdit={editingTextId === textItem.id}
            onEditingComplete={onEditingComplete}
          />
        );
      })}

      {/* Existing images (deletable) */}
      {currentTool === 'select' && existingImageItems.map((imageItem) => {
        const isDeleted = editorState.deletedExistingImages.includes(imageItem.id);
        return (
          <ExistingImageEditor
            key={imageItem.id}
            imageItem={imageItem}
            scale={scale}
            isDeleted={isDeleted}
            isSelected={selectedId === imageItem.id}
            onSelect={() => onSelect(imageItem.id)}
            onDelete={() => onDeleteExistingImage(imageItem.id)}
            onRestore={() => onRestoreExistingImage(imageItem.id)}
          />
        );
      })}

      {/* New text edits */}
      {pageTextEdits.map((textEdit) => (
        <TextEditor
          key={textEdit.id}
          textEdit={textEdit}
          scale={scale}
          isSelected={selectedId === textEdit.id}
          onSelect={() => onSelect(textEdit.id)}
          onUpdate={(updates) => onUpdateTextEdit(textEdit.id, updates)}
        />
      ))}

      {/* New images */}
      {pageImages.map((image) => (
        <ImageEditor
          key={image.id}
          image={image}
          scale={scale}
          isSelected={selectedId === image.id}
          onSelect={() => onSelect(image.id)}
          onUpdate={(updates) => onUpdateImage(image.id, updates)}
        />
      ))}

      {/* Annotation layer */}
      <AnnotationLayer
        pageIndex={pageIndex}
        width={viewport.width}
        height={viewport.height}
        scale={scale}
        currentTool={currentTool}
        selectedId={selectedId}
        onSelect={onSelect}
        toolColor={toolColor}
        strokeWidth={strokeWidth}
        highlights={pageHighlights}
        comments={pageComments}
        drawings={pageDrawings}
        shapes={pageShapes}
        onAddTextEdit={(edit) => onAddTextEdit({ ...edit, pageIndex })}
        onAddHighlight={(highlight) => onAddHighlight({ ...highlight, pageIndex })}
        onAddComment={(comment) => onAddComment({ ...comment, pageIndex })}
        onUpdateComment={onUpdateComment}
        onAddDrawing={(drawing) => onAddDrawing({ ...drawing, pageIndex })}
        onAddShape={(shape) => onAddShape({ ...shape, pageIndex })}
        onUpdateShape={onUpdateShape}
      />
    </div>
  );
}

export function PDFViewer({
  pages,
  scale,
  currentPage,
  onPageChange,
  editorState,
  currentTool,
  selectedId,
  onSelect,
  toolColor,
  strokeWidth,
  onAddTextEdit,
  onUpdateTextEdit,
  onAddHighlight,
  onAddComment,
  onUpdateComment,
  onAddDrawing,
  onAddShape,
  onUpdateShape,
  onUpdateImage,
  onModifyExistingText,
  onDeleteExistingText,
  onRestoreExistingText,
  onDeleteExistingImage,
  onRestoreExistingImage,
  editingTextId,
  onEditingComplete,
}: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingFromClick = useRef(false);
  const lastScrollPage = useRef(currentPage);

  // Scroll-based page tracking - only update if not scrolling from thumbnail click
  const handleScroll = useCallback(() => {
    if (isScrollingFromClick.current) return;

    const container = containerRef.current;
    if (!container) return;

    const pageElements = container.querySelectorAll('[data-page-index]');
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;

    let closestPage = 0;
    let closestDistance = Infinity;

    for (const element of pageElements) {
      const rect = element.getBoundingClientRect();
      const pageCenter = rect.top + rect.height / 2;
      const distance = Math.abs(pageCenter - containerCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = parseInt(element.getAttribute('data-page-index') || '0') + 1;
      }
    }

    if (closestPage > 0 && lastScrollPage.current !== closestPage) {
      lastScrollPage.current = closestPage;
      onPageChange(closestPage);
    }
  }, [onPageChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Scroll to page when currentPage changes from thumbnail click
  useEffect(() => {
    // Only scroll if page changed from external source (not from scrolling)
    if (lastScrollPage.current === currentPage) return;

    const container = containerRef.current;
    if (!container) return;

    const pageElement = container.querySelector(`[data-page-index="${currentPage - 1}"]`);
    if (pageElement) {
      isScrollingFromClick.current = true;
      lastScrollPage.current = currentPage;
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Reset flag after scroll animation completes
      setTimeout(() => {
        isScrollingFromClick.current = false;
      }, 500);
    }
  }, [currentPage]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-4 overflow-auto h-full"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onSelect(null);
        }
      }}
    >
      {pages.map((page, index) => (
        <PageView
          key={index}
          page={page}
          pageIndex={index}
          scale={scale}
          editorState={editorState}
          currentTool={currentTool}
          selectedId={selectedId}
          onSelect={onSelect}
          toolColor={toolColor}
          strokeWidth={strokeWidth}
          onAddTextEdit={onAddTextEdit}
          onUpdateTextEdit={onUpdateTextEdit}
          onAddHighlight={onAddHighlight}
          onAddComment={onAddComment}
          onUpdateComment={onUpdateComment}
          onAddDrawing={onAddDrawing}
          onAddShape={onAddShape}
          onUpdateShape={onUpdateShape}
          onUpdateImage={onUpdateImage}
          onModifyExistingText={onModifyExistingText}
          onDeleteExistingText={onDeleteExistingText}
          onRestoreExistingText={onRestoreExistingText}
          onDeleteExistingImage={onDeleteExistingImage}
          onRestoreExistingImage={onRestoreExistingImage}
          editingTextId={editingTextId}
          onEditingComplete={onEditingComplete}
        />
      ))}
    </div>
  );
}

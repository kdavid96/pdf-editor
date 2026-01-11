import { useState, useCallback, useRef } from 'react';
import type {
  EditorState,
  TextEdit,
  ImageEdit,
  Highlight,
  Comment,
  DrawingPath,
  Shape,
  HistoryEntry,
  Tool,
  TextModification,
} from '../types';

const initialEditorState: EditorState = {
  textEdits: [],
  images: [],
  annotations: {
    highlights: [],
    comments: [],
    drawings: [],
    shapes: [],
  },
  textModifications: [],
  deletedExistingImages: [],
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function cloneState(state: EditorState): EditorState {
  return JSON.parse(JSON.stringify(state));
}

export function useEditor() {
  const [state, setState] = useState<EditorState>(initialEditorState);
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toolColor, setToolColor] = useState('#ffff00');
  const [strokeWidth, setStrokeWidth] = useState(2);

  // History management
  const historyRef = useRef<HistoryEntry[]>([{ editorState: cloneState(initialEditorState), description: 'Initial' }]);
  const historyIndexRef = useRef(0);

  const pushHistory = useCallback((description: string) => {
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push({ editorState: cloneState(state), description });
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
  }, [state]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      setState(cloneState(historyRef.current[historyIndexRef.current].editorState));
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      setState(cloneState(historyRef.current[historyIndexRef.current].editorState));
    }
  }, []);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  // Text edits
  const addTextEdit = useCallback((edit: Omit<TextEdit, 'id'>) => {
    const newEdit: TextEdit = { ...edit, id: generateId() };
    setState((prev) => ({
      ...prev,
      textEdits: [...prev.textEdits, newEdit],
    }));
    pushHistory('Add text');
    return newEdit.id;
  }, [pushHistory]);

  const updateTextEdit = useCallback((id: string, updates: Partial<TextEdit>) => {
    setState((prev) => ({
      ...prev,
      textEdits: prev.textEdits.map((edit) =>
        edit.id === id ? { ...edit, ...updates } : edit
      ),
    }));
  }, []);

  const removeTextEdit = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      textEdits: prev.textEdits.filter((edit) => edit.id !== id),
    }));
    pushHistory('Remove text');
  }, [pushHistory]);

  // Images
  const addImage = useCallback((image: Omit<ImageEdit, 'id'>) => {
    const newImage: ImageEdit = { ...image, id: generateId() };
    setState((prev) => ({
      ...prev,
      images: [...prev.images, newImage],
    }));
    pushHistory('Add image');
    return newImage.id;
  }, [pushHistory]);

  const updateImage = useCallback((id: string, updates: Partial<ImageEdit>) => {
    setState((prev) => ({
      ...prev,
      images: prev.images.map((img) =>
        img.id === id ? { ...img, ...updates } : img
      ),
    }));
  }, []);

  const removeImage = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      images: prev.images.filter((img) => img.id !== id),
    }));
    pushHistory('Remove image');
  }, [pushHistory]);

  // Highlights
  const addHighlight = useCallback((highlight: Omit<Highlight, 'id'>) => {
    const newHighlight: Highlight = { ...highlight, id: generateId() };
    setState((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        highlights: [...prev.annotations.highlights, newHighlight],
      },
    }));
    pushHistory('Add highlight');
    return newHighlight.id;
  }, [pushHistory]);

  const removeHighlight = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        highlights: prev.annotations.highlights.filter((h) => h.id !== id),
      },
    }));
    pushHistory('Remove highlight');
  }, [pushHistory]);

  // Comments
  const addComment = useCallback((comment: Omit<Comment, 'id' | 'createdAt'>) => {
    const newComment: Comment = {
      ...comment,
      id: generateId(),
      createdAt: new Date(),
    };
    setState((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        comments: [...prev.annotations.comments, newComment],
      },
    }));
    pushHistory('Add comment');
    return newComment.id;
  }, [pushHistory]);

  const updateComment = useCallback((id: string, text: string) => {
    setState((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        comments: prev.annotations.comments.map((c) =>
          c.id === id ? { ...c, text } : c
        ),
      },
    }));
  }, []);

  const removeComment = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        comments: prev.annotations.comments.filter((c) => c.id !== id),
      },
    }));
    pushHistory('Remove comment');
  }, [pushHistory]);

  // Drawings
  const addDrawing = useCallback((drawing: Omit<DrawingPath, 'id'>) => {
    const newDrawing: DrawingPath = { ...drawing, id: generateId() };
    setState((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        drawings: [...prev.annotations.drawings, newDrawing],
      },
    }));
    pushHistory('Add drawing');
    return newDrawing.id;
  }, [pushHistory]);

  const removeDrawing = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        drawings: prev.annotations.drawings.filter((d) => d.id !== id),
      },
    }));
    pushHistory('Remove drawing');
  }, [pushHistory]);

  // Shapes
  const addShape = useCallback((shape: Omit<Shape, 'id'>) => {
    const newShape: Shape = { ...shape, id: generateId() };
    setState((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        shapes: [...prev.annotations.shapes, newShape],
      },
    }));
    pushHistory('Add shape');
    return newShape.id;
  }, [pushHistory]);

  const updateShape = useCallback((id: string, updates: Partial<Shape>) => {
    setState((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        shapes: prev.annotations.shapes.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
      },
    }));
  }, []);

  const removeShape = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        shapes: prev.annotations.shapes.filter((s) => s.id !== id),
      },
    }));
    pushHistory('Remove shape');
  }, [pushHistory]);

  // Existing text modifications
  const modifyExistingText = useCallback((id: string, newText: string) => {
    setState((prev) => {
      const existing = prev.textModifications.find((m) => m.id === id);
      if (existing) {
        return {
          ...prev,
          textModifications: prev.textModifications.map((m) =>
            m.id === id ? { ...m, newText, deleted: false } : m
          ),
        };
      }
      return {
        ...prev,
        textModifications: [...prev.textModifications, { id, newText, deleted: false }],
      };
    });
    pushHistory('Edit existing text');
  }, [pushHistory]);

  const deleteExistingText = useCallback((id: string) => {
    setState((prev) => {
      const existing = prev.textModifications.find((m) => m.id === id);
      if (existing) {
        return {
          ...prev,
          textModifications: prev.textModifications.map((m) =>
            m.id === id ? { ...m, deleted: true } : m
          ),
        };
      }
      return {
        ...prev,
        textModifications: [...prev.textModifications, { id, newText: '', deleted: true }],
      };
    });
    pushHistory('Delete existing text');
  }, [pushHistory]);

  const restoreExistingText = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      textModifications: prev.textModifications.filter((m) => m.id !== id),
    }));
    pushHistory('Restore existing text');
  }, [pushHistory]);

  // Existing image deletions
  const deleteExistingImage = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      deletedExistingImages: [...prev.deletedExistingImages, id],
    }));
    pushHistory('Delete existing image');
  }, [pushHistory]);

  const restoreExistingImage = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      deletedExistingImages: prev.deletedExistingImages.filter((i) => i !== id),
    }));
    pushHistory('Restore existing image');
  }, [pushHistory]);

  // Delete selected
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;

    // Check if it's an existing PDF text item
    if (selectedId.startsWith('text-')) {
      setState((prev) => {
        const existing = prev.textModifications.find((m) => m.id === selectedId);
        if (existing) {
          return {
            ...prev,
            textModifications: prev.textModifications.map((m) =>
              m.id === selectedId ? { ...m, deleted: true } : m
            ),
          };
        }
        return {
          ...prev,
          textModifications: [...prev.textModifications, { id: selectedId, newText: '', deleted: true }],
        };
      });
      setSelectedId(null);
      pushHistory('Delete existing text');
      return;
    }

    // Check if it's an existing PDF image
    if (selectedId.startsWith('img-')) {
      setState((prev) => ({
        ...prev,
        deletedExistingImages: [...prev.deletedExistingImages, selectedId],
      }));
      setSelectedId(null);
      pushHistory('Delete existing image');
      return;
    }

    // Handle new edits
    setState((prev) => ({
      ...prev,
      textEdits: prev.textEdits.filter((e) => e.id !== selectedId),
      images: prev.images.filter((e) => e.id !== selectedId),
      annotations: {
        ...prev.annotations,
        highlights: prev.annotations.highlights.filter((e) => e.id !== selectedId),
        comments: prev.annotations.comments.filter((e) => e.id !== selectedId),
        drawings: prev.annotations.drawings.filter((e) => e.id !== selectedId),
        shapes: prev.annotations.shapes.filter((e) => e.id !== selectedId),
      },
    }));
    setSelectedId(null);
    pushHistory('Delete selection');
  }, [selectedId, pushHistory]);

  // Reset
  const reset = useCallback(() => {
    setState(initialEditorState);
    historyRef.current = [{ editorState: cloneState(initialEditorState), description: 'Initial' }];
    historyIndexRef.current = 0;
    setSelectedId(null);
  }, []);

  return {
    state,
    currentTool,
    setCurrentTool,
    selectedId,
    setSelectedId,
    toolColor,
    setToolColor,
    strokeWidth,
    setStrokeWidth,

    // History
    undo,
    redo,
    canUndo,
    canRedo,

    // Text
    addTextEdit,
    updateTextEdit,
    removeTextEdit,

    // Images
    addImage,
    updateImage,
    removeImage,

    // Highlights
    addHighlight,
    removeHighlight,

    // Comments
    addComment,
    updateComment,
    removeComment,

    // Drawings
    addDrawing,
    removeDrawing,

    // Shapes
    addShape,
    updateShape,
    removeShape,

    // Existing content modifications
    modifyExistingText,
    deleteExistingText,
    restoreExistingText,
    deleteExistingImage,
    restoreExistingImage,

    // Utility
    deleteSelected,
    reset,
  };
}

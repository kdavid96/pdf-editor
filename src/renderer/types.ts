import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export interface PDFState {
  document: PDFDocumentProxy | null;
  pages: PDFPageProxy[];
  currentPage: number;
  totalPages: number;
  scale: number;
  filePath: string | null;
  originalData: Uint8Array | null;
}

export interface TextEdit {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
}

export interface ImageEdit {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data: Uint8Array;
  type: 'png' | 'jpg';
}

export interface Highlight {
  id: string;
  pageIndex: number;
  rects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  color: string;
}

export interface Comment {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  text: string;
  createdAt: Date;
}

export interface DrawingPath {
  id: string;
  pageIndex: number;
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
}

export interface Shape {
  id: string;
  pageIndex: number;
  type: 'rectangle' | 'circle' | 'arrow' | 'line';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}

export interface Annotations {
  highlights: Highlight[];
  comments: Comment[];
  drawings: DrawingPath[];
  shapes: Shape[];
}

// Existing PDF content that can be edited/deleted
export interface ExistingTextItem {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontName: string;
  transform: number[];
}

export interface ExistingImageItem {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  objectId: string;
}

export interface TextModification {
  id: string; // matches ExistingTextItem id
  newText: string;
  deleted: boolean;
}

export interface EditorState {
  textEdits: TextEdit[];
  images: ImageEdit[];
  annotations: Annotations;
  // Track modifications to existing content
  textModifications: TextModification[];
  deletedExistingImages: string[]; // IDs of deleted existing images
}

export type Tool =
  | 'select'
  | 'text'
  | 'highlight'
  | 'comment'
  | 'draw'
  | 'shape-rectangle'
  | 'shape-circle'
  | 'shape-arrow'
  | 'shape-line'
  | 'image';

export interface HistoryEntry {
  editorState: EditorState;
  description: string;
}

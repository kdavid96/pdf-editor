import { useState, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { PDFState } from '../types';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const initialState: PDFState = {
  document: null,
  pages: [],
  currentPage: 1,
  totalPages: 0,
  scale: 1.0,
  filePath: null,
  originalData: null,
};

export function usePDF() {
  const [state, setState] = useState<PDFState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to store originalData to avoid stale closure issues
  const originalDataRef = useRef<Uint8Array | null>(null);

  const loadPDF = useCallback(async (data: Uint8Array, filePath?: string) => {
    console.log('loadPDF called with data length:', data?.length, 'filePath:', filePath);
    setLoading(true);
    setError(null);

    try {
      // Make a copy of the data for saving (pdfjs may transfer the ArrayBuffer)
      const dataCopy = new Uint8Array(data);
      originalDataRef.current = dataCopy;

      const loadingTask = pdfjsLib.getDocument({ data });
      const document = await loadingTask.promise;

      const pages: PDFPageProxy[] = [];
      for (let i = 1; i <= document.numPages; i++) {
        const page = await document.getPage(i);
        pages.push(page);
      }

      setState({
        document,
        pages,
        currentPage: 1,
        totalPages: document.numPages,
        scale: 1.0,
        filePath: filePath || null,
        originalData: data,
      });
    } catch (err) {
      originalDataRef.current = null;
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
    } finally {
      setLoading(false);
    }
  }, []);

  const setCurrentPage = useCallback((page: number) => {
    setState((prev) => ({
      ...prev,
      currentPage: Math.max(1, Math.min(page, prev.totalPages)),
    }));
  }, []);

  const setScale = useCallback((scale: number) => {
    setState((prev) => ({
      ...prev,
      scale: Math.max(0.25, Math.min(scale, 4.0)),
    }));
  }, []);

  const zoomIn = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scale: Math.min(prev.scale + 0.25, 4.0),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setState((prev) => ({
      ...prev,
      scale: Math.max(prev.scale - 0.25, 0.25),
    }));
  }, []);

  const closePDF = useCallback(() => {
    if (state.document) {
      state.document.destroy();
    }
    originalDataRef.current = null;
    setState(initialState);
  }, [state.document]);

  const setFilePath = useCallback((filePath: string) => {
    setState((prev) => ({
      ...prev,
      filePath,
    }));
  }, []);

  // Getter function that always returns the latest originalData
  const getOriginalData = useCallback(() => originalDataRef.current, []);

  return {
    ...state,
    loading,
    error,
    loadPDF,
    setCurrentPage,
    setScale,
    zoomIn,
    zoomOut,
    closePDF,
    setFilePath,
    getOriginalData,
  };
}

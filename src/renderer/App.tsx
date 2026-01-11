import { useEffect, useCallback, useState } from 'react';
import { usePDF } from './hooks/usePDF';
import { useEditor } from './hooks/useEditor';
import { Toolbar } from './components/Toolbar';
import { PageThumbnails } from './components/PageThumbnails';
import { PDFViewer } from './components/PDFViewer';
import { savePDF } from './utils/pdfModifier';

// Extract filename from path
function getFileName(filePath: string | null): string {
  if (!filePath) return 'Untitled.pdf';
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'Untitled.pdf';
}

// Get directory from path
function getDirectory(filePath: string | null): string {
  if (!filePath) return '';
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? filePath.substring(0, lastSlash + 1) : '';
}

// Get type of selected element from its ID
function getSelectedType(selectedId: string | null, editorState: typeof import('./hooks/useEditor').useEditor extends () => { state: infer S } ? S : never): string | null {
  if (!selectedId) return null;

  // Check new edits
  if (editorState.textEdits.some(e => e.id === selectedId)) return 'text';
  if (editorState.images.some(e => e.id === selectedId)) return 'image';
  if (editorState.annotations.highlights.some(e => e.id === selectedId)) return 'highlight';
  if (editorState.annotations.comments.some(e => e.id === selectedId)) return 'comment';
  if (editorState.annotations.drawings.some(e => e.id === selectedId)) return 'drawing';
  if (editorState.annotations.shapes.some(e => e.id === selectedId)) return 'shape';

  // Check existing content by ID prefix
  if (selectedId.startsWith('text-')) return 'existing-text';
  if (selectedId.startsWith('img-')) return 'existing-image';

  return null;
}

export default function App() {
  const pdf = usePDF();
  const editor = useEditor();
  const [fileName, setFileName] = useState('Untitled.pdf');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Update fileName when filePath changes
  useEffect(() => {
    setFileName(getFileName(pdf.filePath));
  }, [pdf.filePath]);

  const handleOpenFile = useCallback(async () => {
    const result = await window.electronAPI.openFile();
    if (result) {
      const data = new Uint8Array(result.data);
      await pdf.loadPDF(data, result.path);
      editor.reset();
    }
  }, [pdf, editor]);

  const doSave = useCallback(async (targetPath: string | null) => {
    // Use getter to always get the latest originalData (avoids stale closure)
    const originalData = pdf.getOriginalData();
    console.log('doSave called, originalData length:', originalData?.length);
    if (!originalData) {
      alert('No PDF loaded to save');
      return;
    }

    try {
      console.log('Calling savePDF with data length:', originalData.length);
      const modifiedPdf = await savePDF(originalData, editor.state, pdf.pages);

      let result;
      let finalPath = targetPath;

      if (targetPath) {
        // Save to existing path
        result = await window.electronAPI.saveFile(targetPath, Array.from(modifiedPdf));
      } else {
        // Save As - show dialog
        result = await window.electronAPI.saveFileAs(Array.from(modifiedPdf));
        if (result.path) {
          finalPath = result.path;
        }
      }

      if (result.success && finalPath) {
        // Reload the saved PDF and reset editor state
        await pdf.loadPDF(modifiedPdf, finalPath);
        editor.reset();
        alert('File saved successfully!');
      } else if (!result.canceled) {
        alert('Failed to save: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Save error: ' + (error instanceof Error ? error.message : String(error)));
    }
  }, [pdf, editor]);

  const handleSave = useCallback(() => {
    // Use renamed file path if fileName was changed
    const currentFileName = getFileName(pdf.filePath);
    if (fileName !== currentFileName && pdf.filePath) {
      // User renamed the file, save to new path
      const newPath = getDirectory(pdf.filePath) + fileName;
      doSave(newPath);
    } else {
      doSave(pdf.filePath);
    }
  }, [doSave, pdf.filePath, fileName]);

  const handleSaveAs = useCallback(() => {
    doSave(null);
  }, [doSave]);

  // Get the type of the currently selected element
  const selectedType = getSelectedType(editor.selectedId, editor.state);

  // Handle edit button click - focus on the selected text element
  const handleEditSelected = useCallback(() => {
    if (editor.selectedId && (selectedType === 'text' || selectedType === 'existing-text')) {
      setEditingTextId(editor.selectedId);
    }
  }, [editor.selectedId, selectedType]);

  // Clear editing state when selection changes
  useEffect(() => {
    if (editingTextId && editingTextId !== editor.selectedId) {
      setEditingTextId(null);
    }
  }, [editor.selectedId, editingTextId]);

  const handleAddImage = useCallback(async () => {
    const result = await window.electronAPI.openImage();
    if (result) {
      editor.addImage({
        pageIndex: pdf.currentPage - 1,
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        data: new Uint8Array(result.data),
        type: result.type,
      });
    }
  }, [editor, pdf.currentPage]);

  // Register keyboard shortcuts and menu handlers
  useEffect(() => {
    const unsubscribers = [
      window.electronAPI.onMenuSave(handleSave),
      window.electronAPI.onMenuUndo(editor.undo),
      window.electronAPI.onMenuRedo(editor.redo),
      window.electronAPI.onMenuDelete(editor.deleteSelected),
      window.electronAPI.onZoomIn(pdf.zoomIn),
      window.electronAPI.onZoomOut(pdf.zoomOut),
      window.electronAPI.onFitWidth(() => pdf.setScale(1.0)),
      window.electronAPI.onFitPage(() => pdf.setScale(0.75)),
      window.electronAPI.onFileOpened(async (fileData) => {
        const data = new Uint8Array(fileData.data);
        await pdf.loadPDF(data, fileData.path);
        editor.reset();
      }),
      window.electronAPI.onSaveFileAs((filePath) => {
        doSave(filePath);
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [handleSave, editor, pdf, doSave]);

  // Handle dropped files
  useEffect(() => {
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file && file.name.endsWith('.pdf')) {
        const buffer = await file.arrayBuffer();
        await pdf.loadPDF(new Uint8Array(buffer), file.name);
        editor.reset();
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);

    return () => {
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', handleDragOver);
    };
  }, [pdf, editor]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <Toolbar
        currentTool={editor.currentTool}
        onToolChange={editor.setCurrentTool}
        onOpenFile={handleOpenFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onUndo={editor.undo}
        onRedo={editor.redo}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onZoomIn={pdf.zoomIn}
        onZoomOut={pdf.zoomOut}
        scale={pdf.scale}
        onScaleChange={pdf.setScale}
        toolColor={editor.toolColor}
        onColorChange={editor.setToolColor}
        strokeWidth={editor.strokeWidth}
        onStrokeWidthChange={editor.setStrokeWidth}
        onAddImage={handleAddImage}
        hasDocument={!!pdf.document}
        fileName={fileName}
        onFileNameChange={setFileName}
        hasSelection={!!editor.selectedId}
        onDeleteSelected={editor.deleteSelected}
        onEditSelected={handleEditSelected}
        selectedType={selectedType}
      />

      <div className="flex flex-1 overflow-hidden">
        {pdf.document && (
          <PageThumbnails
            pages={pdf.pages}
            currentPage={pdf.currentPage}
            onPageSelect={pdf.setCurrentPage}
          />
        )}

        <div className="flex-1 overflow-auto bg-gray-200 p-4">
          {pdf.loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-lg text-gray-600">Loading PDF...</div>
            </div>
          )}

          {pdf.error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-lg text-red-600">Error: {pdf.error}</div>
            </div>
          )}

          {!pdf.document && !pdf.loading && !pdf.error && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-24 h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-xl mb-2">No PDF loaded</p>
              <p className="text-sm">Open a file or drag and drop a PDF here</p>
            </div>
          )}

          {pdf.document && !pdf.loading && (
            <PDFViewer
              pages={pdf.pages}
              scale={pdf.scale}
              currentPage={pdf.currentPage}
              onPageChange={pdf.setCurrentPage}
              editorState={editor.state}
              currentTool={editor.currentTool}
              selectedId={editor.selectedId}
              onSelect={editor.setSelectedId}
              toolColor={editor.toolColor}
              strokeWidth={editor.strokeWidth}
              onAddTextEdit={editor.addTextEdit}
              onUpdateTextEdit={editor.updateTextEdit}
              onAddHighlight={editor.addHighlight}
              onAddComment={editor.addComment}
              onUpdateComment={editor.updateComment}
              onAddDrawing={editor.addDrawing}
              onAddShape={editor.addShape}
              onUpdateShape={editor.updateShape}
              onUpdateImage={editor.updateImage}
              onModifyExistingText={editor.modifyExistingText}
              onDeleteExistingText={editor.deleteExistingText}
              onRestoreExistingText={editor.restoreExistingText}
              onDeleteExistingImage={editor.deleteExistingImage}
              onRestoreExistingImage={editor.restoreExistingImage}
              editingTextId={editingTextId}
              onEditingComplete={() => setEditingTextId(null)}
            />
          )}
        </div>
      </div>

      {pdf.document && (
        <div className="bg-gray-800 text-white px-4 py-1 text-sm flex justify-between">
          <span>
            Page {pdf.currentPage} of {pdf.totalPages}
          </span>
          <span>{Math.round(pdf.scale * 100)}%</span>
          <span>{pdf.filePath || 'Untitled'}</span>
        </div>
      )}
    </div>
  );
}

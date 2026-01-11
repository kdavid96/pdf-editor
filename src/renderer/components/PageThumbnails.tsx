import { useEffect, useRef, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';

interface PageThumbnailsProps {
  pages: PDFPageProxy[];
  currentPage: number;
  onPageSelect: (page: number) => void;
}

interface ThumbnailProps {
  page: PDFPageProxy;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
}

function Thumbnail({ page, pageNumber, isActive, onClick }: ThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (rendered) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const viewport = page.getViewport({ scale: 0.15 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (!context) return;

    page.render({
      canvasContext: context,
      viewport,
    }).promise.then(() => {
      setRendered(true);
    });
  }, [page, rendered]);

  return (
    <button
      onClick={onClick}
      className={`p-2 rounded transition-all ${
        isActive ? 'thumbnail-active bg-blue-100' : 'hover:bg-gray-200'
      }`}
    >
      <canvas
        ref={canvasRef}
        className="bg-white shadow-md mx-auto"
        style={{ maxWidth: '100px' }}
      />
      <div className="text-xs text-center mt-1 text-gray-600">{pageNumber}</div>
    </button>
  );
}

export function PageThumbnails({ pages, currentPage, onPageSelect }: PageThumbnailsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to active thumbnail
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeThumb = container.querySelector('.thumbnail-active');
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentPage]);

  return (
    <div
      ref={containerRef}
      className="w-36 bg-gray-100 border-r border-gray-300 overflow-y-auto p-2 flex flex-col gap-2"
    >
      {pages.map((page, index) => (
        <Thumbnail
          key={index}
          page={page}
          pageNumber={index + 1}
          isActive={currentPage === index + 1}
          onClick={() => onPageSelect(index + 1)}
        />
      ))}
    </div>
  );
}

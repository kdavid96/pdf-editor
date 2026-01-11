import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { EditorState, ExistingTextItem, ExistingImageItem } from '../types';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0, g: 0, b: 0 };
}

async function extractTextItems(page: PDFPageProxy, pageIndex: number): Promise<ExistingTextItem[]> {
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });

  return textContent.items
    .filter((item): item is typeof item & { str: string } => 'str' in item && item.str.trim() !== '')
    .map((item, index) => {
      const tx = item.transform;
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
}

async function extractImageItems(page: PDFPageProxy, pageIndex: number): Promise<ExistingImageItem[]> {
  const operatorList = await page.getOperatorList();
  const viewport = page.getViewport({ scale: 1 });
  const images: ExistingImageItem[] = [];

  let currentTransform = [1, 0, 0, 1, 0, 0];
  const transformStack: number[][] = [];

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i];
    const args = operatorList.argsArray[i];

    if (fn === 10) {
      transformStack.push([...currentTransform]);
    } else if (fn === 11) {
      currentTransform = transformStack.pop() || [1, 0, 0, 1, 0, 0];
    } else if (fn === 12) {
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
    } else if (fn === 85 || fn === 88) {
      const objectId = args[0] as string;
      const [a, b, c, d, e, f] = currentTransform;
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

  return images;
}

export async function savePDF(
  originalData: Uint8Array,
  editorState: EditorState,
  pages: PDFPageProxy[]
): Promise<Uint8Array> {
  // Validate input
  if (!originalData || originalData.length === 0) {
    throw new Error('No PDF data provided');
  }

  // Check if data looks like a PDF (starts with %PDF)
  const header = String.fromCharCode(...originalData.slice(0, 5));
  console.log('PDF header check:', header, 'Data length:', originalData.length);

  if (!header.startsWith('%PDF')) {
    throw new Error(`Invalid PDF data - header: "${header}", length: ${originalData.length}`);
  }

  const pdfDoc = await PDFDocument.load(originalData, { ignoreEncryption: true });
  const pdfPages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Process each page
  for (let pageIndex = 0; pageIndex < pdfPages.length; pageIndex++) {
    const page = pdfPages[pageIndex];
    const pdfJsPage = pages[pageIndex];
    const viewport = pdfJsPage.getViewport({ scale: 1 });
    const { height: pageHeight } = page.getSize();

    const convertY = (y: number) => pageHeight - y;

    // Extract existing text and image items for this page
    const existingTextItems = await extractTextItems(pdfJsPage, pageIndex);
    const existingImageItems = await extractImageItems(pdfJsPage, pageIndex);

    // STEP 1: Redact deleted/modified existing text
    for (const textItem of existingTextItems) {
      const modification = editorState.textModifications.find((m) => m.id === textItem.id);

      if (modification) {
        // Draw white rectangle over original text to redact it
        page.drawRectangle({
          x: textItem.x - 2,
          y: convertY(textItem.y + textItem.height) - 2,
          width: textItem.width + 4,
          height: textItem.height + 4,
          color: rgb(1, 1, 1), // White
        });

        // If modified (not deleted), draw the new text
        if (!modification.deleted && modification.newText.trim()) {
          page.drawText(modification.newText, {
            x: textItem.x,
            y: convertY(textItem.y + textItem.fontSize),
            size: textItem.fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        }
      }
    }

    // STEP 2: Redact deleted existing images
    for (const imageItem of existingImageItems) {
      if (editorState.deletedExistingImages.includes(imageItem.id)) {
        // Draw white rectangle over the image to redact it
        page.drawRectangle({
          x: imageItem.x - 2,
          y: convertY(imageItem.y + imageItem.height) - 2,
          width: imageItem.width + 4,
          height: imageItem.height + 4,
          color: rgb(1, 1, 1), // White
        });
      }
    }

    // STEP 3: Add new text edits
    const pageTextEdits = editorState.textEdits.filter((e) => e.pageIndex === pageIndex);
    for (const textEdit of pageTextEdits) {
      if (textEdit.text.trim()) {
        const { r, g, b } = hexToRgb(textEdit.color);
        page.drawText(textEdit.text, {
          x: textEdit.x,
          y: convertY(textEdit.y + textEdit.fontSize),
          size: textEdit.fontSize,
          font,
          color: rgb(r, g, b),
        });
      }
    }

    // STEP 4: Add new images
    const pageImages = editorState.images.filter((e) => e.pageIndex === pageIndex);
    for (const imageEdit of pageImages) {
      try {
        const image =
          imageEdit.type === 'png'
            ? await pdfDoc.embedPng(imageEdit.data)
            : await pdfDoc.embedJpg(imageEdit.data);

        page.drawImage(image, {
          x: imageEdit.x,
          y: convertY(imageEdit.y + imageEdit.height),
          width: imageEdit.width,
          height: imageEdit.height,
        });
      } catch (error) {
        console.error('Failed to embed image:', error);
      }
    }

    // STEP 5: Add highlights
    const pageHighlights = editorState.annotations.highlights.filter(
      (e) => e.pageIndex === pageIndex
    );
    for (const highlight of pageHighlights) {
      const { r, g, b } = hexToRgb(highlight.color);
      for (const rect of highlight.rects) {
        page.drawRectangle({
          x: rect.x,
          y: convertY(rect.y + rect.height),
          width: rect.width,
          height: rect.height,
          color: rgb(r, g, b),
          opacity: 0.4,
        });
      }
    }

    // STEP 6: Add drawings
    const pageDrawings = editorState.annotations.drawings.filter(
      (e) => e.pageIndex === pageIndex
    );
    for (const drawing of pageDrawings) {
      const { r, g, b } = hexToRgb(drawing.color);
      for (let i = 0; i < drawing.points.length - 1; i++) {
        const start = drawing.points[i];
        const end = drawing.points[i + 1];
        page.drawLine({
          start: { x: start.x, y: convertY(start.y) },
          end: { x: end.x, y: convertY(end.y) },
          thickness: drawing.width,
          color: rgb(r, g, b),
        });
      }
    }

    // STEP 7: Add shapes
    const pageShapes = editorState.annotations.shapes.filter(
      (e) => e.pageIndex === pageIndex
    );
    for (const shape of pageShapes) {
      const { r, g, b } = hexToRgb(shape.color);

      switch (shape.type) {
        case 'rectangle':
          page.drawRectangle({
            x: shape.x,
            y: convertY(shape.y + shape.height),
            width: shape.width,
            height: shape.height,
            borderColor: rgb(r, g, b),
            borderWidth: shape.strokeWidth,
          });
          break;

        case 'circle':
          page.drawEllipse({
            x: shape.x + shape.width / 2,
            y: convertY(shape.y + shape.height / 2),
            xScale: shape.width / 2,
            yScale: shape.height / 2,
            borderColor: rgb(r, g, b),
            borderWidth: shape.strokeWidth,
          });
          break;

        case 'line':
          page.drawLine({
            start: { x: shape.x, y: convertY(shape.y) },
            end: { x: shape.x + shape.width, y: convertY(shape.y + shape.height) },
            thickness: shape.strokeWidth,
            color: rgb(r, g, b),
          });
          break;

        case 'arrow':
          const startX = shape.x;
          const startY = convertY(shape.y);
          const endX = shape.x + shape.width;
          const endY = convertY(shape.y + shape.height);

          page.drawLine({
            start: { x: startX, y: startY },
            end: { x: endX, y: endY },
            thickness: shape.strokeWidth,
            color: rgb(r, g, b),
          });

          const angle = Math.atan2(endY - startY, endX - startX);
          const headLen = 15;

          page.drawLine({
            start: { x: endX, y: endY },
            end: {
              x: endX - headLen * Math.cos(angle - Math.PI / 6),
              y: endY - headLen * Math.sin(angle - Math.PI / 6),
            },
            thickness: shape.strokeWidth,
            color: rgb(r, g, b),
          });

          page.drawLine({
            start: { x: endX, y: endY },
            end: {
              x: endX - headLen * Math.cos(angle + Math.PI / 6),
              y: endY - headLen * Math.sin(angle + Math.PI / 6),
            },
            thickness: shape.strokeWidth,
            color: rgb(r, g, b),
          });
          break;
      }
    }

    // STEP 8: Add comment markers
    const pageComments = editorState.annotations.comments.filter(
      (e) => e.pageIndex === pageIndex
    );
    for (const comment of pageComments) {
      page.drawRectangle({
        x: comment.x,
        y: convertY(comment.y + 20),
        width: 20,
        height: 20,
        color: rgb(1, 0.8, 0),
        borderColor: rgb(0.8, 0.6, 0),
        borderWidth: 1,
      });

      if (comment.text) {
        page.drawText('!', {
          x: comment.x + 7,
          y: convertY(comment.y + 15),
          size: 12,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
  }

  return await pdfDoc.save();
}

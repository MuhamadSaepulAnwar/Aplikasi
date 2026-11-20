import { toJpeg, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export type PrintPaperMode = 'a4' | 'thermal';

function sanitizeFilePart(raw: string): string {
  return (raw || 'dokumen')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'dokumen';
}

function triggerDownload(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Captures a DOM element to a crisp white-background data URL with automatic
 * font-CORS fallback so Tailwind CSS v4 (oklch colors) and logos export reliably.
 */
async function captureElementImage(
  element: HTMLElement,
  format: 'jpeg' | 'png',
  pixelRatio = 2.5
): Promise<{ dataUrl: string; width: number; height: number }> {
  // Ensure webfonts are loaded before rendering
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness errors
    }
  }

  const width = element.scrollWidth || element.offsetWidth || 800;
  const height = element.scrollHeight || element.offsetHeight || 1000;

  const baseOptions = {
    backgroundColor: '#ffffff',
    pixelRatio,
    cacheBust: true,
    width,
    height,
    style: {
      margin: '0',
      boxShadow: 'none',
      borderRadius: '0',
      border: 'none',
    },
  };

  const renderFn = format === 'jpeg' ? toJpeg : toPng;

  try {
    const dataUrl = await renderFn(element, {
      ...baseOptions,
      quality: 0.95,
    });
    return { dataUrl, width, height };
  } catch {
    // Retry without embedding external stylesheet fonts if browser blocks cssRules
    const dataUrl = await renderFn(element, {
      ...baseOptions,
      quality: 0.95,
      skipFonts: true,
    });
    return { dataUrl, width, height };
  }
}

/**
 * Downloads the target element as a high-resolution JPG image.
 */
export async function exportElementToJpg(element: HTMLElement, baseFilename: string): Promise<void> {
  const { dataUrl } = await captureElementImage(element, 'jpeg', 2.5);
  triggerDownload(dataUrl, `${sanitizeFilePart(baseFilename)}.jpg`);
}

/**
 * Downloads the target element as a properly sized A4 or Thermal 80mm PDF file.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  baseFilename: string,
  mode: PrintPaperMode
): Promise<void> {
  const { dataUrl, width, height } = await captureElementImage(element, 'jpeg', 2.5);
  const safeName = `${sanitizeFilePart(baseFilename)}.pdf`;

  if (mode === 'thermal') {
    // 80mm thermal receipt roll with dynamic height matching content aspect ratio
    const paperWidthMm = 80;
    const marginMm = 2;
    const contentWidthMm = paperWidthMm - marginMm * 2;
    const contentHeightMm = (height / width) * contentWidthMm;
    const paperHeightMm = Math.max(60, Math.ceil(contentHeightMm + marginMm * 2));

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [paperWidthMm, paperHeightMm],
      compress: true,
    });

    pdf.addImage(dataUrl, 'JPEG', marginMm, marginMm, contentWidthMm, contentHeightMm, undefined, 'FAST');
    pdf.save(safeName);
    return;
  }

  // Standard A4 Portrait PDF (210mm x 297mm) with automatic multi-page slicing if content is very tall
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const marginMm = 10;
  const usableWidthMm = pageWidthMm - marginMm * 2;
  const usableHeightMm = pageHeightMm - marginMm * 2;
  const imgHeightMm = (height / width) * usableWidthMm;

  if (imgHeightMm <= usableHeightMm) {
    pdf.addImage(dataUrl, 'JPEG', marginMm, marginMm, usableWidthMm, imgHeightMm, undefined, 'FAST');
  } else {
    // Multi-page vertical pagination
    let remainingHeightMm = imgHeightMm;
    let offsetMm = 0;
    let pageIdx = 0;

    while (remainingHeightMm > 0) {
      if (pageIdx > 0) pdf.addPage();
      pdf.addImage(
        dataUrl,
        'JPEG',
        marginMm,
        marginMm - offsetMm,
        usableWidthMm,
        imgHeightMm,
        undefined,
        'FAST'
      );
      remainingHeightMm -= usableHeightMm;
      offsetMm += usableHeightMm;
      pageIdx += 1;
    }
  }

  pdf.save(safeName);
}

/**
 * Prints ONLY the target document cleanly via an isolated hidden iframe with exact
 * A4 or Thermal 80mm @page sizing, avoiding background app leakage and window.open.
 */
export async function printElementDocument(
  element: HTMLElement,
  mode: PrintPaperMode,
  docTitle: string
): Promise<void> {
  const { dataUrl } = await captureElementImage(element, 'png', 3);

  await new Promise<void>((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const cleanup = () => {
      window.setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1500);
    };

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      cleanup();
      reject(new Error('Browser tidak mengizinkan jendela cetak.'));
      return;
    }

    const pageCss =
      mode === 'thermal'
        ? `@page { size: 80mm auto; margin: 2mm; }
           body { margin: 0; padding: 0; background: #fff; text-align: center; }
           img { width: 76mm; max-width: 100%; height: auto; display: block; margin: 0 auto; }`
        : `@page { size: A4 portrait; margin: 10mm; }
           body { margin: 0; padding: 0; background: #fff; }
           img { width: 100%; max-width: 190mm; height: auto; display: block; margin: 0 auto; }`;

    doc.open();
    doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${docTitle.replace(/[<>]/g, '')}</title>
    <style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      ${pageCss}
    </style>
  </head>
  <body>
    <img id="print-doc-img" src="${dataUrl}" alt="${docTitle.replace(/["<>]/g, '')}" />
  </body>
</html>`);
    doc.close();

    const imgEl = doc.getElementById('print-doc-img') as HTMLImageElement | null;
    const triggerPrint = () => {
      try {
        win.focus();
        win.print();
        cleanup();
        resolve();
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    if (imgEl && !imgEl.complete) {
      imgEl.onload = () => window.setTimeout(triggerPrint, 80);
      imgEl.onerror = () => {
        cleanup();
        reject(new Error('Gagal memuat gambar dokumen untuk dicetak.'));
      };
    } else {
      window.setTimeout(triggerPrint, 120);
    }
  });
}

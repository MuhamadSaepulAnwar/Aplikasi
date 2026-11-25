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

function toPageArray(target: HTMLElement | HTMLElement[]): HTMLElement[] {
  return Array.isArray(target) ? target.filter(Boolean) : [target];
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal merender halaman dokumen.'));
    img.src = src;
  });
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
 * Downloads the target element(s) as a high-resolution JPG image.
 * When multiple pages are passed (e.g. Page 1 Invoice + Page 2 PO Mockup),
 * stitches them cleanly vertically onto one crisp high-DPI sheet.
 */
export async function exportElementToJpg(
  target: HTMLElement | HTMLElement[],
  baseFilename: string
): Promise<void> {
  const pages = toPageArray(target);
  if (pages.length === 1) {
    const { dataUrl } = await captureElementImage(pages[0], 'jpeg', 2.5);
    triggerDownload(dataUrl, `${sanitizeFilePart(baseFilename)}.jpg`);
    return;
  }

  const captured = await Promise.all(pages.map((p) => captureElementImage(p, 'png', 2.2)));
  const imgs = await Promise.all(captured.map((c) => loadImageElement(c.dataUrl)));

  const gapPx = 36;
  const maxWidth = Math.max(...imgs.map((im) => im.width));
  const totalHeight = imgs.reduce((s, im) => s + im.height, 0) + gapPx * (imgs.length - 1);

  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas tidak tersedia untuk ekspor gambar.');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, maxWidth, totalHeight);

  let yOffset = 0;
  for (let i = 0; i < imgs.length; i++) {
    const im = imgs[i];
    const xOffset = Math.round((maxWidth - im.width) / 2);
    ctx.drawImage(im, xOffset, yOffset);
    yOffset += im.height;
    if (i < imgs.length - 1) {
      // Subtle cut divider between Page 1 and Page 2
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(0, yOffset, maxWidth, gapPx);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(24, yOffset + gapPx / 2);
      ctx.lineTo(maxWidth - 24, yOffset + gapPx / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      yOffset += gapPx;
    }
  }

  const stitchedUrl = canvas.toDataURL('image/jpeg', 0.94);
  triggerDownload(stitchedUrl, `${sanitizeFilePart(baseFilename)}.jpg`);
}

/**
 * Downloads the target element(s) as a properly sized A4 or Thermal 80mm PDF file.
 * Each element in an array starts cleanly on its own PDF page (e.g. Page 1 Invoice, Page 2 PO Mockup).
 */
export async function exportElementToPdf(
  target: HTMLElement | HTMLElement[],
  baseFilename: string,
  mode: PrintPaperMode
): Promise<void> {
  const pages = toPageArray(target);
  const safeName = `${sanitizeFilePart(baseFilename)}.pdf`;

  if (mode === 'thermal') {
    const { dataUrl, width, height } = await captureElementImage(pages[0], 'jpeg', 2.5);
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

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const { dataUrl, width, height } = await captureElementImage(pages[pIdx], 'jpeg', 2.4);
    if (pIdx > 0) pdf.addPage();

    const imgHeightMm = (height / width) * usableWidthMm;

    if (imgHeightMm <= usableHeightMm) {
      pdf.addImage(dataUrl, 'JPEG', marginMm, marginMm, usableWidthMm, imgHeightMm, undefined, 'FAST');
    } else {
      let remainingHeightMm = imgHeightMm;
      let offsetMm = 0;
      let sliceIdx = 0;

      while (remainingHeightMm > 0) {
        if (sliceIdx > 0) pdf.addPage();
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
        sliceIdx += 1;
      }
    }
  }

  pdf.save(safeName);
}

/**
 * Prints ONLY the target document page(s) cleanly via an isolated hidden iframe with exact
 * A4 or Thermal 80mm @page sizing, avoiding background app leakage and window.open.
 */
export async function printElementDocument(
  target: HTMLElement | HTMLElement[],
  mode: PrintPaperMode,
  docTitle: string
): Promise<void> {
  const pages = toPageArray(target);
  const captured = await Promise.all(pages.map((p) => captureElementImage(p, 'png', 2.8)));

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
           .print-page img { width: 76mm; max-width: 100%; height: auto; display: block; margin: 0 auto; }`
        : `@page { size: A4 portrait; margin: 10mm; }
           body { margin: 0; padding: 0; background: #fff; }
           .print-page { page-break-after: always; break-after: page; }
           .print-page:last-child { page-break-after: auto; break-after: auto; }
           .print-page img { width: 100%; max-width: 190mm; max-height: 277mm; object-fit: contain; height: auto; display: block; margin: 0 auto; }`;

    const safeTitle = docTitle.replace(/[<>]/g, '');
    const safeAlt = docTitle.replace(/["<>]/g, '');
    const pagesHtml = captured
      .map(
        (c, idx) =>
          `<div class="print-page"><img class="print-doc-img" src="${c.dataUrl}" alt="${safeAlt} - Halaman ${idx + 1}" /></div>`
      )
      .join('');

    doc.open();
    doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      ${pageCss}
    </style>
  </head>
  <body>
    ${pagesHtml}
  </body>
</html>`);
    doc.close();

    const imgEls = Array.from(doc.querySelectorAll('img.print-doc-img')) as HTMLImageElement[];
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

    const waitImages = imgEls.map(
      (imgEl) =>
        new Promise<void>((resImg, rejImg) => {
          if (imgEl.complete) {
            resImg();
          } else {
            imgEl.onload = () => resImg();
            imgEl.onerror = () => rejImg(new Error('Gagal memuat gambar dokumen untuk dicetak.'));
          }
        })
    );

    Promise.all(waitImages)
      .then(() => window.setTimeout(triggerPrint, 100))
      .catch((err) => {
        cleanup();
        reject(err);
      });
  });
}

'use client';

import React, { useState, useCallback } from 'react';
import { Image as ImageIcon, Download, X, Loader2, ExternalLink, Copy, Check } from 'lucide-react';

interface DocumentImageModalProps {
  /** Ref ke elemen HTML yang akan dirender menjadi gambar */
  documentRef: React.RefObject<HTMLElement | null>;
  /** Label tombol trigger (default: "Lihat sebagai Gambar") */
  label?: string;
  /** Nama file saat download (tanpa ekstensi) */
  filename?: string;
  /** Class tambahan untuk tombol trigger */
  triggerClassName?: string;
}

/**
 * DocumentImageModal — Merender konten dokumen (HTML) ke gambar PNG beresolusi tinggi
 * menggunakan html2canvas dengan standarisasi lebar 800px (A4).
 * Fitur:
 * - Salin Gambar Langsung ke Clipboard (bisa langsung Ctrl+V di WhatsApp Web)
 * - Download Gambar PNG Kualitas Tinggi
 * - Buka Gambar di Tab Baru
 * - Klik kanan → Open Image / Save As
 */
export function DocumentImageModal({
  documentRef,
  label = 'Lihat sebagai Gambar',
  filename = 'dokumen',
  triggerClassName,
}: DocumentImageModalProps) {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExport = useCallback(async () => {
    if (!documentRef.current) {
      setError('Konten dokumen tidak ditemukan.');
      return;
    }

    setIsRendering(true);
    setError(null);
    setImageDataUrl(null);
    setCopied(false);

    try {
      // Dynamic import agar tidak memengaruhi SSR
      const html2canvas = (await import('html2canvas')).default;

      // Tunggu semua font (termasuk Google Fonts Montserrat) selesai dimuat
      // agar html2canvas tidak merender dengan font fallback yang berbeda metrics
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const canvas = await html2canvas(documentRef.current, {
        scale: 2,              // 2x resolusi tinggi untuk teks tajam & jernih
        useCORS: true,         // Izinkan gambar cross-origin (logo, ttd)
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        // Sesuaikan windowWidth dengan lebar konten aktual (820px + padding)
        // agar Tailwind responsive classes tidak memicu breakpoint yang salah
        windowWidth: 820,
        onclone: (clonedDoc, clonedElement) => {
          // 0. Inject style defaults ke cloned document untuk mencegah font fallback & teks vertikal
          const styleTag = clonedDoc.createElement('style');
          styleTag.textContent = `
            *, *::before, *::after {
              writing-mode: horizontal-tb !important;
              direction: ltr !important;
              box-sizing: border-box !important;
            }
            html, body, * {
              font-family: 'Montserrat', system-ui, -apple-system, sans-serif !important;
            }
            .w-3\\.5, .h-3\\.5 { width: 14px !important; height: 14px !important; }
            .flex { display: flex !important; }
            .items-center { align-items: center !important; }
            .justify-center { justify-content: center !important; }
          `;
          clonedDoc.head.appendChild(styleTag);

          // 1. Reset root & body di dalam iframe klon agar tidak ada margin/padding/scrollbars
          clonedDoc.documentElement.style.margin = '0';
          clonedDoc.documentElement.style.padding = '0';
          clonedDoc.documentElement.style.width = '820px';
          clonedDoc.documentElement.style.minWidth = '820px';
          clonedDoc.documentElement.style.background = '#ffffff';
          clonedDoc.documentElement.style.writingMode = 'horizontal-tb';
          clonedDoc.documentElement.style.direction = 'ltr';

          clonedDoc.body.style.margin = '0';
          clonedDoc.body.style.padding = '0';
          clonedDoc.body.style.width = '820px';
          clonedDoc.body.style.minWidth = '820px';
          clonedDoc.body.style.background = '#ffffff';
          clonedDoc.body.style.overflow = 'visible';
          clonedDoc.body.style.writingMode = 'horizontal-tb';
          clonedDoc.body.style.direction = 'ltr';
          clonedDoc.body.style.fontFamily = "'Montserrat', system-ui, -apple-system, sans-serif";

          // 2. Unconstrain semua elemen ancestor di atas clonedElement
          let current: HTMLElement | null = clonedElement.parentElement;
          while (current && current !== clonedDoc.body) {
            current.style.width = '820px';
            current.style.maxWidth = '820px';
            current.style.minWidth = '0';
            current.style.padding = '0';
            current.style.margin = '0 auto';
            current.style.overflow = 'visible';
            current.style.transform = 'none';
            current.style.display = 'block';
            current.style.writingMode = 'horizontal-tb';
            current.style.direction = 'ltr';
            current = current.parentElement;
          }

          // 3. Set styling persis untuk clonedElement (dokumen sheet A4)
          clonedElement.style.width = '820px';
          clonedElement.style.maxWidth = '820px';
          clonedElement.style.minWidth = '820px';
          clonedElement.style.margin = '0 auto';
          clonedElement.style.padding = '28px 32px';
          clonedElement.style.boxSizing = 'border-box';
          clonedElement.style.backgroundColor = '#ffffff';
          clonedElement.style.boxShadow = 'none';
          clonedElement.style.borderRadius = '0px';
          clonedElement.style.transform = 'none';
          clonedElement.style.overflow = 'visible';
          clonedElement.style.position = 'relative';
          clonedElement.style.display = 'flex';
          clonedElement.style.flexDirection = 'column';
          clonedElement.style.writingMode = 'horizontal-tb';
          clonedElement.style.direction = 'ltr';
          clonedElement.style.fontFamily = "'Montserrat', system-ui, -apple-system, sans-serif";

          // 4. Paksa semua elemen turunan untuk text horizontal (cegah teks vertikal)
          const allElements = clonedElement.querySelectorAll('*');
          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.writingMode = 'horizontal-tb';
            htmlEl.style.direction = 'ltr';
            // Pastikan font konsisten
            if (!htmlEl.style.fontFamily) {
              htmlEl.style.fontFamily = "'Montserrat', system-ui, -apple-system, sans-serif";
            }
          });

          // 5. Pastikan semua sub-wrapper tidak terpotong atau wrap
          const allSubWrappers = clonedElement.querySelectorAll('.doc-preview-wrapper, .estimation-table-wrapper, .estimation-header-box, .estimation-terms-box, .estimation-signatures-box');
          allSubWrappers.forEach((w) => {
            const el = w as HTMLElement;
            el.style.width = '100%';
            el.style.maxWidth = '100%';
            el.style.overflow = 'visible';
          });

          // 6. Pastikan semua tabel proporsional
          const tables = clonedElement.querySelectorAll('table');
          tables.forEach((table) => {
            (table as HTMLElement).style.width = '100%';
            (table as HTMLElement).style.borderCollapse = 'collapse';
            (table as HTMLElement).style.tableLayout = 'auto';
          });

          // 7. Perbaiki tampilan checkbox Unicode (☑ ☐) — ganti agar konsisten di semua browser
          // Cari semua text node yang mengandung karakter checkbox dan pastikan ditampilkan lurus
          const walker = clonedDoc.createTreeWalker(
            clonedElement,
            NodeFilter.SHOW_TEXT,
            null
          );
          const textNodesToFix: Text[] = [];
          let node: Node | null;
          while ((node = walker.nextNode())) {
            const text = node.textContent || '';
            if (text.includes('☑') || text.includes('☐') || text.includes('✓')) {
              textNodesToFix.push(node as Text);
            }
          }
          // Wrap checkbox chars in spans with explicit inline styling
          textNodesToFix.forEach((textNode) => {
            const parent = textNode.parentElement;
            if (!parent) return;
            const text = textNode.textContent || '';
            const span = clonedDoc.createElement('span');
            span.style.fontFamily = 'Arial, sans-serif';
            span.style.writingMode = 'horizontal-tb';
            span.style.direction = 'ltr';
            span.style.display = 'inline';
            span.textContent = text;
            parent.replaceChild(span, textNode);
          });
        },
      });

      const dataUrl = canvas.toDataURL('image/png');
      setImageDataUrl(dataUrl);
    } catch (err) {
      console.error('html2canvas error:', err);
      setError('Gagal merender dokumen menjadi gambar. Coba lagi.');
    } finally {
      setIsRendering(false);
    }
  }, [documentRef]);

  const handleDownload = useCallback(() => {
    if (!imageDataUrl) return;
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = `${filename}.png`;
    link.click();
  }, [imageDataUrl, filename]);

  const handleCopyImage = useCallback(async () => {
    if (!imageDataUrl) return;
    try {
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        // Fallback jika clipboard API image tidak didukung
        handleDownload();
      }
    } catch (e) {
      console.warn('Copy to clipboard error:', e);
      handleDownload();
    }
  }, [imageDataUrl, handleDownload]);

  const handleOpenNewTab = useCallback(() => {
    if (!imageDataUrl) return;
    const win = window.open();
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${filename} - Mardiono Home Service</title>
            <style>
              body {
                margin: 0;
                background: #0f172a;
                display: flex;
                justify-content: center;
                align-items: flex-start;
                min-height: 100vh;
                padding: 24px;
                box-sizing: border-box;
                font-family: system-ui, sans-serif;
              }
              img {
                max-width: 100%;
                width: 800px;
                background: #ffffff;
                border-radius: 8px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.6);
              }
            </style>
          </head>
          <body>
            <img src="${imageDataUrl}" alt="${filename}" />
          </body>
        </html>
      `);
      win.document.close();
    }
  }, [imageDataUrl, filename]);

  const handleClose = useCallback(() => {
    setImageDataUrl(null);
    setError(null);
    setCopied(false);
  }, []);

  return (
    <>
      {/* Tombol Trigger */}
      <button
        type="button"
        onClick={handleExport}
        disabled={isRendering}
        className={
          triggerClassName ||
          'inline-flex items-center space-x-1.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md cursor-pointer'
        }
        title="Ekspor dokumen sebagai gambar PNG beresolusi tinggi"
      >
        {isRendering ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ImageIcon className="w-4 h-4" />
        )}
        <span>{isRendering ? 'Memproses...' : label}</span>
      </button>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-red-600 text-white px-4 py-2 rounded-xl text-sm shadow-xl font-bold">
          {error}
        </div>
      )}

      {/* Modal Image Preview */}
      {imageDataUrl && (
        <div
          className="fixed inset-0 z-[9998] bg-black/85 backdrop-blur-md flex flex-col items-center justify-start overflow-y-auto p-3 sm:p-6"
          onClick={handleClose}
        >
          {/* Floating Action Control Bar */}
          <div
            className="sticky top-0 z-[9999] mb-4 flex items-center gap-2.5 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl px-4 py-2.5 shadow-2xl flex-wrap justify-between w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2 text-white min-w-0">
              <ImageIcon className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-bold truncate">{filename}.png</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Salin Gambar ke Clipboard */}
              <button
                type="button"
                onClick={handleCopyImage}
                className={`inline-flex items-center space-x-1.5 font-bold text-xs px-3 py-1.5 rounded-xl transition shadow-xs cursor-pointer ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-violet-600 hover:bg-violet-700 text-white'
                }`}
                title="Salin gambar ke clipboard untuk dipaste langsung di WhatsApp"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin! (Ctrl+V)</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Gambar</span>
                  </>
                )}
              </button>

              {/* Buka Tab Baru */}
              <button
                type="button"
                onClick={handleOpenNewTab}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer"
                title="Buka gambar di tab baru"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Tab Baru</span>
              </button>

              {/* Download PNG */}
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer"
                title="Download gambar sebagai file PNG"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                aria-label="Tutup preview gambar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Gambar Dokumen Hasil Export */}
          <div
            className="w-full flex flex-col items-center justify-center pb-12"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white p-2 rounded-2xl shadow-2xl border border-slate-700 max-w-[820px] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUrl}
                alt={filename}
                className="w-full h-auto rounded-xl block shadow-inner"
                style={{ imageRendering: 'auto' }}
                draggable
              />
            </div>
            <p className="text-center text-slate-400 text-xs mt-3 bg-slate-900/80 px-4 py-1.5 rounded-full border border-slate-700/60 shadow-sm">
              💡 Klik <strong>Salin Gambar</strong> untuk langsung <em>Paste (Ctrl+V)</em> ke WhatsApp Web, atau klik kanan gambar untuk simpan.
            </p>
          </div>
        </div>
      )}
    </>
  );
}


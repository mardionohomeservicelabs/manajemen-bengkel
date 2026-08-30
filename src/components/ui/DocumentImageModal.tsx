'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Image as ImageIcon, Download, X, Loader2, ExternalLink } from 'lucide-react';

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
 * DocumentImageModal — Merender konten dokumen (HTML) ke gambar PNG
 * menggunakan html2canvas. Menampilkan modal dengan gambar yang bisa:
 * - Klik kanan → Open Image in New Tab
 * - Klik kanan → Save Image As
 * - Klik tombol Download
 * - Klik tombol Open in New Tab
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

  const handleExport = useCallback(async () => {
    if (!documentRef.current) {
      setError('Konten dokumen tidak ditemukan.');
      return;
    }

    setIsRendering(true);
    setError(null);
    setImageDataUrl(null);

    try {
      // Dynamic import agar tidak memengaruhi SSR
      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(documentRef.current, {
        scale: 2,              // 2x resolusi untuk kualitas tinggi
        useCORS: true,         // izinkan gambar cross-origin (logo bengkel)
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        // Pastikan seluruh elemen terrender termasuk yang di-overflow
        windowWidth: documentRef.current.scrollWidth,
        windowHeight: documentRef.current.scrollHeight,
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

  const handleOpenNewTab = useCallback(() => {
    if (!imageDataUrl) return;
    const win = window.open();
    if (win) {
      win.document.write(`
        <html>
          <head><title>${filename}</title></head>
          <body style="margin:0;background:#1e1e2e;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;padding:20px;box-sizing:border-box;">
            <img src="${imageDataUrl}" style="max-width:100%;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.5);" />
          </body>
        </html>
      `);
      win.document.close();
    }
  }, [imageDataUrl, filename]);

  const handleClose = useCallback(() => {
    setImageDataUrl(null);
    setError(null);
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
          'inline-flex items-center space-x-1.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md'
        }
        title="Ekspor dokumen sebagai gambar PNG"
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-red-600 text-white px-4 py-2 rounded-xl text-sm shadow-xl">
          {error}
        </div>
      )}

      {/* Modal Image Preview */}
      {imageDataUrl && (
        <div
          className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-start overflow-y-auto p-4 sm:p-8"
          onClick={handleClose}
        >
          {/* Floating Action Bar */}
          <div
            className="sticky top-0 z-[9999] mb-4 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl px-4 py-2.5 shadow-2xl flex-wrap justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2 text-white">
              <ImageIcon className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-bold">{filename}.png</span>
            </div>
            <div className="h-4 w-px bg-slate-600" />
            <span className="text-[11px] text-slate-400">
              Klik kanan pada gambar untuk membuka di tab baru atau menyimpan
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleOpenNewTab}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition"
                title="Buka gambar di tab baru"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Tab Baru</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition"
                title="Download sebagai PNG"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Gambar Dokumen — bisa klik kanan */}
          <div onClick={(e) => e.stopPropagation()}>
            <img
              src={imageDataUrl}
              alt={filename}
              className="max-w-full rounded-2xl shadow-2xl border border-slate-700 cursor-default select-none"
              style={{ imageRendering: 'auto' }}
              draggable
              title="Klik kanan → Open Image in New Tab / Save Image As"
            />
            <p className="text-center text-slate-500 text-xs mt-3">
              💡 Klik kanan gambar di atas → <em>Open Image in New Tab</em> atau <em>Save Image As</em>
            </p>
          </div>
        </div>
      )}
    </>
  );
}

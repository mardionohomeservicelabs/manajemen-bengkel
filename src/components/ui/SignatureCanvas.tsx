'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, PenTool } from 'lucide-react';

interface SignatureCanvasProps {
  initialDataUrl?: string;
  onSave?: (dataUrl: string) => void;
  readOnly?: boolean;
}

export function SignatureCanvas({
  initialDataUrl,
  onSave,
  readOnly = false,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(Boolean(initialDataUrl));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);

    ctx.strokeStyle = '#800000'; // Maroon signature ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = initialDataUrl;
    }
  }, [initialDataUrl]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing || readOnly) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && onSave) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  const clearCanvas = () => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    setHasDrawn(false);
    if (onSave) {
      onSave('');
    }
  };

  return (
    <div className="w-full">
      <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/70 overflow-hidden touch-none hover:border-maroon-300 transition-colors">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full h-36 sm:h-44 ${readOnly ? 'cursor-default' : 'cursor-crosshair'}`}
        />

        {/* Guide line & hint */}
        {!hasDrawn && !readOnly && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
            <PenTool className="w-6 h-6 mb-1 text-slate-300" />
            <p className="text-xs font-medium">Tanda Tangan Pelanggan di Sini</p>
            <p className="text-[10px] text-slate-400">Gunakan jari / stylus / mouse</p>
          </div>
        )}

        {/* Signature Line Indicator */}
        <div className="absolute bottom-6 left-6 right-6 border-b border-slate-300/60 pointer-events-none" />
      </div>

      {!readOnly && (
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={clearCanvas}
            className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 transition"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Hapus / Ulangi</span>
          </button>
          <span className="text-[11px] text-slate-400">
            {hasDrawn ? '✓ Tanda tangan tersimpan' : 'Wajib tanda tangan'}
          </span>
        </div>
      )}
    </div>
  );
}

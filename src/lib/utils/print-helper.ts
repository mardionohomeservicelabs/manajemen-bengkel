/**
 * Helper untuk mencetak dokumen (SPK, Checkup, Estimasi, Invoice) secara bersih
 * Menghilangkan halaman ganda/kosong, tanpa margin berlebih, dan memastikan
 * dokumen dicetak tepat 1 lembar (atau halaman sesuai isi tanpa duplikasi).
 */
export function printCleanDocument(element: HTMLElement | null, documentTitle: string) {
  if (!element) return;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Kumpulkan link stylesheets (Tailwind + Google Fonts) & style tags
  const linkStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((el) => {
      const href = (el as HTMLLinkElement).href;
      return `<link rel="stylesheet" href="${href}" />`;
    })
    .join('\n');

  const styleTags = Array.from(document.querySelectorAll('style'))
    .map((el) => el.outerHTML)
    .join('\n');

  // Ambil HTML murni dari elemen dokumen
  let docHtml = element.innerHTML;
  docHtml = docHtml.replace(/src="\/([^"]+)"/g, `src="${origin}/$1"`);
  docHtml = docHtml.replace(/href="\/([^"]+)"/g, `href="${origin}/$1"`);

  const popupHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${documentTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  ${linkStyles}
  ${styleTags}
  <style>
    :root, html, body {
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-font-smoothing: auto !important;
      -moz-osx-font-smoothing: auto !important;
      text-rendering: optimizeLegibility !important;
    }
    @page {
      size: A4 portrait;
      margin: 4mm 6mm;
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      box-sizing: border-box !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Montserrat', 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif !important;
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
    }
    body * {
      visibility: visible !important;
    }
    .doc-preview-wrapper {
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      display: block !important;
      width: 100% !important;
      height: auto !important;
    }
    .doc-sheet {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 4px 8px !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      display: block !important;
      height: auto !important;
    }

    /* ==============================================================================
       WINDOWS 7 & EPSON L3110 HIGH-CONTRAST PURE BLACK (#000000) STYLING RULES
       Mencegah teks & garis menjadi abu-abu pudar karena halftoning driver printer.
    ============================================================================== */
    
    /* 1. Teks Default & Slate Override ke Hitam Pekat */
    .doc-sheet,
    .doc-sheet p,
    .doc-sheet td,
    .doc-sheet th,
    .doc-sheet li,
    .doc-sheet label,
    .doc-sheet strong,
    .doc-sheet b,
    .doc-sheet h1,
    .doc-sheet h2,
    .doc-sheet h3,
    .doc-sheet h4,
    .doc-sheet h5,
    .doc-sheet h6,
    .doc-sheet .text-slate-950,
    .doc-sheet .text-slate-900,
    .doc-sheet .text-slate-800,
    .doc-sheet .text-slate-700,
    .doc-sheet .text-slate-600,
    .doc-sheet .text-slate-500,
    .doc-sheet .text-slate-400,
    .doc-sheet .text-gray-900,
    .doc-sheet .text-gray-800,
    .doc-sheet .text-gray-700,
    .doc-sheet .text-gray-600,
    .doc-sheet .text-gray-500,
    .doc-sheet .text-gray-400,
    .printable-estimation-sheet .text-slate-950,
    .printable-estimation-sheet .text-slate-900,
    .printable-estimation-sheet .text-slate-800,
    .printable-estimation-sheet .text-slate-700,
    .printable-estimation-sheet .text-slate-600,
    .printable-estimation-sheet .text-slate-500,
    .printable-estimation-sheet .text-slate-400 {
      color: #000000 !important;
    }

    /* 2. Pelestarian Teks Putih pada Badge / Bar Berwarna (Estimasi, SPK, Nota) */
    .doc-sheet .text-white,
    .doc-sheet [class*="text-white"],
    .printable-estimation-sheet .text-white,
    .printable-estimation-sheet [class*="text-white"] {
      color: #ffffff !important;
    }

    /* 3. Pelestarian Warna Aksen Khas Bengkel (Maroon, Navy, Emerald) dengan Kontras Tinggi */
    .doc-sheet .text-\\[\\#8B0000\\],
    .doc-sheet [class*="text-[#8B0000]"],
    .doc-sheet .text-maroon-700,
    .doc-sheet .text-maroon-800,
    .doc-sheet .text-maroon-900 {
      color: #8B0000 !important;
    }
    .doc-sheet .text-\\[\\#001F7A\\],
    .doc-sheet [class*="text-[#001F7A]"],
    .doc-sheet .text-blue-950,
    .doc-sheet [class*="text-blue-950"] {
      color: #001F7A !important;
    }
    .doc-sheet .text-emerald-900,
    .doc-sheet [class*="text-emerald-900"],
    .doc-sheet .text-emerald-800 {
      color: #065f46 !important;
    }

    /* 4. Garis Batas Tabel, Sel, dan Kotak Dokumen Menjadi Hitam Solid (#000000) */
    .doc-sheet table,
    .doc-sheet th,
    .doc-sheet td,
    .printable-estimation-sheet table,
    .printable-estimation-sheet th,
    .printable-estimation-sheet td {
      border-color: #000000 !important;
      vertical-align: middle !important;
    }

    .doc-sheet [class*="border-slate-"],
    .doc-sheet [class*="border-gray-"],
    .printable-estimation-sheet [class*="border-slate-"],
    .printable-estimation-sheet [class*="border-gray-"] {
      border-color: #000000 !important;
    }

    .doc-sheet [class*="border-dashed"] {
      border-style: dashed !important;
      border-color: #475569 !important;
    }

    .doc-sheet th,
    .printable-estimation-sheet th {
      color: #000000 !important;
      background-color: #f1f5f9 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .official-document-logo {
      width: 240px !important;
      min-width: 240px !important;
      max-width: 240px !important;
      height: 47px !important;
      min-height: 47px !important;
      max-height: 47px !important;
      object-fit: contain !important;
      object-position: left center !important;
      display: block !important;
    }
    .avoid-break, .break-avoid, .page-break-avoid, tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table, .estimation-items-table {
      page-break-inside: auto !important;
      break-inside: auto !important;
    }
    .printable-estimation-sheet thead,
    .printable-estimation-sheet .estimation-items-table thead,
    .estimation-items-thead {
      display: table-row-group !important;
    }
    .printable-estimation-sheet tfoot,
    .printable-estimation-sheet .estimation-items-table tfoot,
    .estimation-grand-total-tbody {
      display: table-row-group !important;
    }
    .no-print {
      display: none !important;
    }

    @media print {
      @page {
        size: A4 portrait;
        margin: 4mm 6mm;
      }
      *, *::before, *::after {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        width: 100% !important;
        height: auto !important;
      }
      .doc-sheet,
      .doc-sheet p,
      .doc-sheet td,
      .doc-sheet th,
      .doc-sheet li,
      .doc-sheet label,
      .doc-sheet strong,
      .doc-sheet b,
      .doc-sheet h1,
      .doc-sheet h2,
      .doc-sheet h3,
      .doc-sheet h4,
      .doc-sheet h5,
      .doc-sheet h6,
      .doc-sheet .text-slate-950,
      .doc-sheet .text-slate-900,
      .doc-sheet .text-slate-800,
      .doc-sheet .text-slate-700,
      .doc-sheet .text-slate-600,
      .doc-sheet .text-slate-500,
      .doc-sheet .text-slate-400,
      .doc-sheet .text-gray-900,
      .doc-sheet .text-gray-800,
      .doc-sheet .text-gray-700,
      .doc-sheet .text-gray-600,
      .doc-sheet .text-gray-500,
      .doc-sheet .text-gray-400,
      .printable-estimation-sheet .text-slate-950,
      .printable-estimation-sheet .text-slate-900,
      .printable-estimation-sheet .text-slate-800,
      .printable-estimation-sheet .text-slate-700,
      .printable-estimation-sheet .text-slate-600,
      .printable-estimation-sheet .text-slate-500,
      .printable-estimation-sheet .text-slate-400 {
        color: #000000 !important;
      }

      .doc-sheet .text-white,
      .doc-sheet [class*="text-white"],
      .printable-estimation-sheet .text-white,
      .printable-estimation-sheet [class*="text-white"] {
        color: #ffffff !important;
      }

      .doc-sheet .text-\\[\\#8B0000\\],
      .doc-sheet [class*="text-[#8B0000]"],
      .doc-sheet .text-maroon-700,
      .doc-sheet .text-maroon-800,
      .doc-sheet .text-maroon-900 {
        color: #8B0000 !important;
      }
      .doc-sheet .text-\\[\\#001F7A\\],
      .doc-sheet [class*="text-[#001F7A]"],
      .doc-sheet .text-blue-950,
      .doc-sheet [class*="text-blue-950"] {
        color: #001F7A !important;
      }
      .doc-sheet .text-emerald-900,
      .doc-sheet [class*="text-emerald-900"],
      .doc-sheet .text-emerald-800 {
        color: #065f46 !important;
      }

      .doc-sheet table,
      .doc-sheet th,
      .doc-sheet td,
      .printable-estimation-sheet table,
      .printable-estimation-sheet th,
      .printable-estimation-sheet td {
        border-color: #000000 !important;
        vertical-align: middle !important;
      }

      .doc-sheet [class*="border-slate-"],
      .doc-sheet [class*="border-gray-"],
      .printable-estimation-sheet [class*="border-slate-"],
      .printable-estimation-sheet [class*="border-gray-"] {
        border-color: #000000 !important;
      }

      .doc-sheet [class*="border-dashed"] {
        border-style: dashed !important;
        border-color: #475569 !important;
      }

      .doc-sheet th,
      .printable-estimation-sheet th {
        color: #000000 !important;
        background-color: #f1f5f9 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .official-document-logo {
        width: 240px !important;
        min-width: 240px !important;
        max-width: 240px !important;
        height: 47px !important;
        min-height: 47px !important;
        max-height: 47px !important;
        object-fit: contain !important;
        object-position: left center !important;
        display: block !important;
      }
      .printable-estimation-sheet thead,
      .printable-estimation-sheet .estimation-items-table thead,
      .estimation-items-thead {
        display: table-row-group !important;
      }
      .printable-estimation-sheet tfoot,
      .printable-estimation-sheet .estimation-items-table tfoot,
      .estimation-grand-total-tbody {
        display: table-row-group !important;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="doc-preview-wrapper">
    <div class="doc-sheet">
      ${docHtml}
    </div>
  </div>
  <script>
    window.addEventListener('load', function() {
      function triggerPrint() {
        window.focus();
        window.print();
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
          setTimeout(triggerPrint, 350);
        }).catch(function() {
          setTimeout(triggerPrint, 500);
        });
      } else {
        setTimeout(triggerPrint, 500);
      }
      window.onafterprint = function() {
        setTimeout(function() { window.close(); }, 300);
      };
    });
  <\/script>
</body>
</html>`;

  const popup = window.open('', '_blank', 'width=920,height=1000,scrollbars=yes');
  if (!popup) {
    alert('Popup diblokir browser. Izinkan popup untuk halaman ini lalu coba lagi.');
    return;
  }
  popup.document.open();
  popup.document.write(popupHtml);
  popup.document.close();
}


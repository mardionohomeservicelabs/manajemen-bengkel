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
<html lang="id" class="light" style="color-scheme: light; forced-color-adjust: none;">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <meta name="darkreader-lock" content="true" />
  <title>${documentTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  ${linkStyles}
  ${styleTags}
  <style>
    :root, html, body {
      color-scheme: light !important;
      forced-color-adjust: none !important;
      background: #ffffff !important;
      color: #0f172a !important;
      -webkit-font-smoothing: antialiased !important;
    }
    @page {
      size: A4 portrait;
      margin: 4mm 6mm;
    }
    *, *::before, *::after {
      color-scheme: light !important;
      forced-color-adjust: none !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      box-sizing: border-box !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: 'Montserrat', system-ui, -apple-system, sans-serif !important;
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
      color: #0f172a !important;
      display: block !important;
      height: auto !important;
    }
    /* Anti-faded / High-contrast text rules for Windows 7 and all browsers */
    .doc-sheet, .doc-sheet * {
      color-scheme: light !important;
    }
    .doc-sheet .text-slate-950,
    .doc-sheet .text-slate-900,
    .doc-sheet .text-slate-800,
    .doc-sheet .text-slate-700,
    .printable-estimation-sheet .text-slate-950,
    .printable-estimation-sheet .text-slate-900,
    .printable-estimation-sheet .text-slate-800,
    .printable-estimation-sheet .text-slate-700 {
      color: #0f172a !important;
    }
    .doc-sheet .text-slate-600,
    .doc-sheet .text-slate-500,
    .printable-estimation-sheet .text-slate-600,
    .printable-estimation-sheet .text-slate-500 {
      color: #1e293b !important;
    }
    .doc-sheet .text-slate-400,
    .printable-estimation-sheet .text-slate-400 {
      color: #334155 !important;
    }
    .doc-sheet th,
    .printable-estimation-sheet th {
      color: #0f172a !important;
      background-color: #f1f5f9 !important;
    }
    .doc-sheet table,
    .doc-sheet th,
    .doc-sheet td,
    .printable-estimation-sheet table,
    .printable-estimation-sheet th,
    .printable-estimation-sheet td {
      border-color: #334155 !important;
      vertical-align: middle !important;
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
        color-scheme: light !important;
        forced-color-adjust: none !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      html, body {
        color-scheme: light !important;
        forced-color-adjust: none !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        width: 100% !important;
        height: auto !important;
      }
      .doc-sheet, .doc-sheet * {
        color-scheme: light !important;
      }
      .doc-sheet .text-slate-950,
      .doc-sheet .text-slate-900,
      .doc-sheet .text-slate-800,
      .doc-sheet .text-slate-700,
      .printable-estimation-sheet .text-slate-950,
      .printable-estimation-sheet .text-slate-900,
      .printable-estimation-sheet .text-slate-800,
      .printable-estimation-sheet .text-slate-700 {
        color: #0f172a !important;
      }
      .doc-sheet .text-slate-600,
      .doc-sheet .text-slate-500,
      .printable-estimation-sheet .text-slate-600,
      .printable-estimation-sheet .text-slate-500 {
        color: #1e293b !important;
      }
      .doc-sheet .text-slate-400,
      .printable-estimation-sheet .text-slate-400 {
        color: #334155 !important;
      }
      .doc-sheet th,
      .printable-estimation-sheet th {
        color: #0f172a !important;
        background-color: #f1f5f9 !important;
      }
      .doc-sheet table,
      .doc-sheet th,
      .doc-sheet td,
      .printable-estimation-sheet table,
      .printable-estimation-sheet th,
      .printable-estimation-sheet td {
        border-color: #334155 !important;
        vertical-align: middle !important;
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
      setTimeout(function() {
        window.print();
        setTimeout(function() { window.close(); }, 1200);
      }, 400);
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


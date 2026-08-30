/**
 * Helper untuk mencetak dokumen (SPK, Checkup, Estimasi, Invoice) secara bersih
 * Menghilangkan halaman ganda/kosong, tanpa margin berlebih, dan memastikan
 * dokumen dicetak tepat 1 lembar (atau halaman sesuai isi tanpa duplikasi).
 */
export function printCleanDocument(element: HTMLElement | null, documentTitle: string) {
  if (!element) return;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Kumpulkan link stylesheets (Tailwind + Google Fonts)
  const linkStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((el) => {
      const href = (el as HTMLLinkElement).href;
      return `<link rel="stylesheet" href="${href}" />`;
    })
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
  <style>
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
      display: block !important;
      height: auto !important;
    }
    .avoid-break, .break-avoid, .page-break-avoid, tr, table {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .no-print {
      display: none !important;
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 4mm 6mm;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        width: 100% !important;
        height: auto !important;
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


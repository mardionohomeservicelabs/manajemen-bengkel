/**
 * Helper untuk mencetak dokumen (SPK, Checkup, Estimasi, Invoice) secara bersih
 * tanpa margin/padding berlebih di bagian atas, tanpa terpotong di bagian bawah,
 * dan menjaga agar format warna serta pemisahan halaman (page break) rapi.
 */
export function printCleanDocument(element: HTMLElement | null, documentTitle: string) {
  if (!element) return;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const inlineStyles = Array.from(document.querySelectorAll('style'))
    .map((el) => `<style>${el.textContent}</style>`)
    .join('\n');

  const linkStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((el) => {
      const href = (el as HTMLLinkElement).href;
      return `<link rel="stylesheet" href="${href}" />`;
    })
    .join('\n');

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
  ${inlineStyles}
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      box-sizing: border-box;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      font-family: 'Montserrat', system-ui, sans-serif !important;
      width: 100% !important;
    }
    .doc-preview-wrapper {
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      display: block !important;
      width: 100% !important;
    }
    .doc-sheet {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      background: #ffffff !important;
      display: block !important;
    }
    .avoid-break, .break-avoid, .page-break-avoid, tr, table {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .page-break-before {
      page-break-before: always !important;
      break-before: page !important;
    }
    .no-print { display: none !important; }
    @media print {
      @page {
        size: A4 portrait;
        margin: 6mm 8mm;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="doc-preview-wrapper">
    <div class="doc-sheet space-y-2.5">
      ${docHtml}
    </div>
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() { window.close(); }, 1200);
      }, 500);
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

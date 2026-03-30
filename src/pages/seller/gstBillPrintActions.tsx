import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import gstBillCss from './gstBillPrint.css?raw';
import { GstBillPrintTemplate } from './GstBillPrintTemplate';
import type { GenerateBillInput } from './generateBillPdf';

function pageCssRule(input: GenerateBillInput): string {
  return input.type === 'gst'
    ? '@media print { @page { size: A4 landscape; margin: 10mm; } }'
    : '@media print { @page { size: A4 portrait; margin: 10mm; } }';
}

/** Opens a print dialog with the HTML/CSS GST bill (GST-Bill–style layout). */
export function printGstBill(input: GenerateBillInput): void {
  const w = window.open('', '_blank');
  if (!w) {
    window.alert('Allow pop-ups to print the bill.');
    return;
  }
  const pageRule = pageCssRule(input);
  w.document.open();
  w.document.write(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><style>${gstBillCss}\n${pageRule}</style></head><body style="margin:0;background:#fff"><div id="gst-root"></div></body></html>`,
  );
  w.document.close();
  const mount = w.document.getElementById('gst-root');
  if (!mount) return;
  const root = createRoot(mount);
  root.render(<GstBillPrintTemplate input={input} />);
  window.setTimeout(() => {
    w.focus();
    w.print();
  }, 400);
}

/** Renders the same HTML template to a PDF (image-based, matches on-screen layout). */
export async function downloadGstBillPdf(input: GenerateBillInput, fileName: string): Promise<void> {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:fixed;left:-12000px;top:0;z-index:-1;overflow:visible;background:#fff;pointer-events:none;';
  const inner = document.createElement('div');
  inner.style.width = input.type === 'gst' ? '1123px' : '794px';
  inner.style.background = '#fff';
  wrap.appendChild(inner);
  document.body.appendChild(wrap);

  const root = createRoot(inner);
  root.render(<GstBillPrintTemplate input={input} />);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise((r) => window.setTimeout(r, 120));

  try {
    const canvas = await html2canvas(inner, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });
    const pdf = new jsPDF({
      orientation: input.type === 'gst' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL('image/png');
    const props = pdf.getImageProperties(imgData);
    const imgW = pageW;
    const imgH = (props.height * pageW) / props.width;
    if (imgH <= pageH) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
    } else {
      const scale = pageH / imgH;
      pdf.addImage(imgData, 'PNG', 0, 0, imgW * scale, pageH);
    }
    pdf.save(fileName);
  } finally {
    root.unmount();
    document.body.removeChild(wrap);
  }
}

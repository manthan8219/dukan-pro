import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import './BarcodeScanPage.css';

const VIEWPORT_ID = 'barcode-scan-viewport';
const DEDUPE_MS = 1200;

const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
];

type ScanLine = { text: string; format: string; at: number };

function playScanFeedback(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 920;
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    osc.start(t0);
    osc.stop(t0 + 0.11);
    void ctx.close();
  } catch {
    /* ignore */
  }
  try {
    navigator.vibrate?.(45);
  } catch {
    /* ignore */
  }
}

function formatLabel(decodedResult: unknown): string {
  if (!decodedResult || typeof decodedResult !== 'object') return '';
  const r = decodedResult as { result?: { format?: number | string } };
  const f = r.result?.format;
  if (f === undefined || f === null) return '';
  return String(f);
}

export function BarcodeScanPage() {
  const headingId = useId();
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanLine[]>([]);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const appendScan = useCallback((text: string, format: string) => {
    const now = Date.now();
    const prev = lastRef.current;
    if (prev.text === text && now - prev.at < DEDUPE_MS) return;
    lastRef.current = { text, at: now };
    playScanFeedback();
    setScans((s) => [{ text, format: format || '—', at: now }, ...s].slice(0, 80));
  }, []);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const elId = VIEWPORT_ID;
    const scanner = new Html5Qrcode(elId, {
      formatsToSupport: FORMATS,
      verbose: false,
    });
    scannerRef.current = scanner;

    const run = async () => {
      setError(null);
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (w, h) => ({
              width: Math.min(340, Math.floor(w * 0.92)),
              height: Math.min(200, Math.floor(h * 0.38)),
            }),
          },
          (decodedText, decodedResult) => {
            if (cancelled) return;
            appendScan(decodedText, formatLabel(decodedResult));
          },
          () => {},
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Camera failed to start');
          setActive(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (!s) return;
      void s
        .stop()
        .then(() => s.clear())
        .catch(() => {});
    };
  }, [active, appendScan]);

  return (
    <div className="barcodeScan" aria-labelledby={headingId}>
      <header className="barcodeScan__header">
        <h1 id={headingId} className="barcodeScan__title">
          Scan
        </h1>
        <p className="barcodeScan__hint">Open this URL on your phone — no sign-in required.</p>
      </header>

      <div className="barcodeScan__stage">
        <div id={VIEWPORT_ID} className="barcodeScan__viewport" />
        {!active && (
          <div className="barcodeScan__overlay">
            <button type="button" className="barcodeScan__start" onClick={() => setActive(true)}>
              Start camera
            </button>
            {error ? <p className="barcodeScan__error">{error}</p> : null}
          </div>
        )}
      </div>

      {active ? (
        <div className="barcodeScan__toolbar">
          <button type="button" className="barcodeScan__stop" onClick={() => setActive(false)}>
            Stop camera
          </button>
        </div>
      ) : null}

      <section className="barcodeScan__log" aria-label="Recent scans">
        {scans.length === 0 ? (
          <p className="barcodeScan__logEmpty">Scans appear here as you go — no popups.</p>
        ) : (
          <ul className="barcodeScan__list">
            {scans.map((row) => (
              <li key={`${row.at}-${row.text}`} className="barcodeScan__row">
                <span className="barcodeScan__code">{row.text}</span>
                <span className="barcodeScan__fmt">{row.format}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

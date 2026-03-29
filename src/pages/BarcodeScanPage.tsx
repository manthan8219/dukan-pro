import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import type { Socket } from 'socket.io-client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  WS_JOIN_SESSION,
  WS_SCAN,
  WS_SCAN_RECEIVED,
  WS_SESSION_ERROR,
  WS_SESSION_READY,
} from '../scannerRelay/events';
import { createScannerSocket } from '../scannerRelay/createScannerSocket';
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

function playScanFeedback(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
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

export function BarcodeScanPage() {
  const headingId = useId();
  const [params] = useSearchParams();
  const sessionId = (params.get('sessionId') ?? '').trim();

  const [relayReady, setRelayReady] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const emitScan = useCallback((socket: Socket, text: string) => {
    socket.emit(WS_SCAN, { sessionId, barcode: text });
  }, [sessionId]);

  const handleDecoded = useCallback(
    (text: string, socket: Socket) => {
      const now = Date.now();
      const prev = lastRef.current;
      if (prev.text === text && now - prev.at < DEDUPE_MS) return;
      lastRef.current = { text, at: now };
      if (!socket.connected) return;
      playScanFeedback();
      emitScan(socket, text);
    },
    [emitScan],
  );

  useEffect(() => {
    if (!sessionId) return;

    const socket = createScannerSocket();
    socketRef.current = socket;
    let cancelled = false;

    const join = () => {
      setJoinError(null);
      socket.emit(WS_JOIN_SESSION, { sessionId, type: 'mobile' as const });
    };

    socket.on('connect', () => {
      if (cancelled) return;
      setSocketConnected(true);
      join();
    });

    socket.on('disconnect', () => {
      if (cancelled) return;
      setSocketConnected(false);
      setRelayReady(false);
    });

    socket.on(WS_SESSION_READY, () => {
      if (cancelled) return;
      setRelayReady(true);
    });

    socket.on(WS_SESSION_ERROR, (p: { message?: string }) => {
      if (cancelled) return;
      setJoinError(
        typeof p?.message === 'string' ? p.message : 'Could not join session',
      );
      setRelayReady(false);
    });

    socket.on(WS_SCAN_RECEIVED, (p: { barcode?: string }) => {
      if (cancelled) return;
      if (typeof p?.barcode === 'string') {
        setLastSent(p.barcode);
      }
    });

    socket.connect();

    return () => {
      cancelled = true;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!relayReady || !sessionId) return;

    const socket = socketRef.current;
    if (!socket) return;

    let cancelled = false;
    const elId = VIEWPORT_ID;
    const scanner = new Html5Qrcode(elId, {
      formatsToSupport: FORMATS,
      verbose: false,
    });
    scannerRef.current = scanner;

    const run = async () => {
      setCameraError(null);
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (w, h) => ({
              width: Math.min(340, Math.floor(w * 0.92)),
              height: Math.min(240, Math.floor(h * 0.42)),
            }),
          },
          (decodedText) => {
            if (cancelled) return;
            handleDecoded(decodedText, socket);
          },
          () => {},
        );
      } catch (e) {
        if (!cancelled) {
          setCameraError(e instanceof Error ? e.message : 'Camera failed');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      scannerRef.current = null;
      void scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {});
    };
  }, [relayReady, sessionId, handleDecoded]);

  if (!sessionId) {
    return (
      <div className="barcodeScan barcodeScan--error" aria-labelledby={headingId}>
        <h1 id={headingId} className="barcodeScan__title">
          Invalid link
        </h1>
        <p className="barcodeScan__hint">
          Open the QR code from the laptop &ldquo;Connect scanner&rdquo; page. The URL must include{' '}
          <code className="barcodeScan__inlineCode">sessionId</code>.
        </p>
      </div>
    );
  }

  if (joinError) {
    return (
      <div className="barcodeScan barcodeScan--error" aria-labelledby={headingId}>
        <h1 id={headingId} className="barcodeScan__title">
          Cannot connect
        </h1>
        <p className="barcodeScan__error">{joinError}</p>
      </div>
    );
  }

  return (
    <div className="barcodeScan barcodeScan--relay" aria-labelledby={headingId}>
      <div className="barcodeScan__relayBar" role="status">
        <span
          className={`barcodeScan__dot barcodeScan__dot--${
            socketConnected ? 'on' : 'off'
          }`}
          aria-hidden
        />
        {socketConnected
          ? relayReady
            ? 'Live — point at a barcode'
            : 'Joining session…'
          : 'Reconnecting…'}
      </div>

      <div className="barcodeScan__stage barcodeScan__stage--fullscreen">
        <div id={VIEWPORT_ID} className="barcodeScan__viewport" />
        {!relayReady ? (
          <div className="barcodeScan__overlay">
            <p className="barcodeScan__hint">Starting camera…</p>
          </div>
        ) : null}
        {cameraError ? (
          <div className="barcodeScan__overlay">
            <p className="barcodeScan__error">{cameraError}</p>
          </div>
        ) : null}
      </div>

      {lastSent ? (
        <footer className="barcodeScan__footer">
          <span className="barcodeScan__footerLabel">Last sent</span>
          <span className="barcodeScan__footerCode">{lastSent}</span>
        </footer>
      ) : null}
    </div>
  );
}

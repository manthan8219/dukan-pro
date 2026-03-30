import { BarcodeFormat } from '@zxing/library';
import type { Socket } from 'socket.io-client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DecodeHintType, useZxing, type Result } from 'react-zxing';
import {
  WS_JOIN_SESSION,
  WS_SCAN,
  WS_SCAN_RECEIVED,
  WS_SESSION_ERROR,
  WS_SESSION_READY,
} from '../scannerRelay/events';
import { createScannerSocket } from '../scannerRelay/createScannerSocket';
import './BarcodeScanPage.css';

const DEDUPE_MS = 1200;

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
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const [relayReady, setRelayReady] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const socketRef = useRef<Socket | null>(null);

  const zxingHints = useMemo(() => {
    const m = new Map<DecodeHintType, unknown>();
    m.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);
    m.set(DecodeHintType.TRY_HARDER, true);
    return m;
  }, []);

  const onDecodeResult = useCallback((result: Result) => {
    const sid = sessionIdRef.current;
    const socket = socketRef.current;
    if (!sid || !socket?.connected) return;
    const text = result.getText().trim();
    if (!text) return;
    const now = Date.now();
    const prev = lastRef.current;
    if (prev.text === text && now - prev.at < DEDUPE_MS) return;
    lastRef.current = { text, at: now };
    playScanFeedback();
    socket.emit(WS_SCAN, { sessionId: sid, barcode: text });
  }, []);

  const onZxingError = useCallback((err: unknown) => {
    setCameraError(err instanceof Error ? err.message : 'Camera failed');
  }, []);

  const scannerPaused =
    !sessionId || !relayReady || joinError !== null;

  const { ref: videoRef } = useZxing({
    paused: scannerPaused,
    hints: zxingHints as Map<DecodeHintType, any>,
    constraints: {
      audio: false,
      video: { facingMode: 'environment' },
    },
    timeBetweenDecodingAttempts: 200,
    onDecodeResult,
    onError: onZxingError,
  });

  useEffect(() => {
    if (relayReady) setCameraError(null);
  }, [relayReady]);

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
        <video
          ref={videoRef}
          className="barcodeScan__viewport"
          muted
          playsInline
          autoPlay
        />
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

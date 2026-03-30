import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  DecodeHintType,
} from '@zxing/library';
import type { Socket } from 'socket.io-client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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

const DEDUPE_MS = 1200;
/** Throttle native BarcodeDetector (fast path) — every frame is expensive */
const NATIVE_DETECT_INTERVAL_MS = 80;
/** ZXing attempts; lower = snappier but more CPU */
const ZXING_DECODE_INTERVAL_MS = 90;

const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

function tryCreateNativeDetector(): BarcodeDetectorInstance | null {
  const Ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  if (typeof Ctor !== 'function') return null;

  const formatSets = [
    [
      'ean_13',
      'ean_8',
      'upc_a',
      'upc_e',
      'code_128',
      'code_39',
      'code_93',
      'codabar',
      'itf',
      'qr_code',
      'data_matrix',
      'pdf417',
    ],
    ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
    ['ean_13', 'code_128', 'qr_code'],
  ];

  for (const formats of formatSets) {
    try {
      return new Ctor({ formats });
    } catch {
      /* unsupported combo on this browser */
    }
  }
  return null;
}

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
  const relayReadyRef = useRef(relayReady);
  relayReadyRef.current = relayReady;

  const [joinError, setJoinError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPreviewOn, setCameraPreviewOn] = useState(false);
  const [scannerBackend, setScannerBackend] = useState<'native' | 'zxing' | null>(
    null,
  );
  const [lastSent, setLastSent] = useState<string | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const zxingHints = useMemo(() => {
    const m = new Map<DecodeHintType, unknown>();
    m.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.CODABAR,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.PDF_417,
    ]);
    m.set(DecodeHintType.TRY_HARDER, true);
    return m;
  }, []);

  const handleDecodedText = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const now = Date.now();
    const prev = lastRef.current;
    if (prev.text === text && now - prev.at < DEDUPE_MS) return;
    lastRef.current = { text, at: now };

    const sid = sessionIdRef.current;
    const socket = socketRef.current;
    const canSend = Boolean(
      sid && relayReadyRef.current && socket?.connected,
    );

    playScanFeedback();
    setLastSent(text);

    if (canSend) {
      socket!.emit(WS_SCAN, { sessionId: sid, barcode: text });
    }
  }, []);

  const cameraBlocked = !sessionId || joinError !== null;

  useEffect(() => {
    if (cameraBlocked) {
      setCameraPreviewOn(false);
      setScannerBackend(null);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let reader: BrowserMultiFormatReader | null = null;
    let rafNative = 0;
    let lastNativeAt = 0;
    let zxingStopping = false;

    setCameraError(null);
    setCameraPreviewOn(false);
    setScannerBackend(null);

    const stopAll = () => {
      cancelled = true;
      zxingStopping = true;
      cancelAnimationFrame(rafNative);
      try {
        reader?.reset();
      } catch {
        /* ignore */
      }
      reader = null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      if (video.srcObject) {
        video.srcObject = null;
      }
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setCameraPreviewOn(true);

        const native = tryCreateNativeDetector();
        if (native) {
          setScannerBackend('native');
          const tickNative = (t: number) => {
            if (cancelled) return;
            if (t - lastNativeAt >= NATIVE_DETECT_INTERVAL_MS) {
              lastNativeAt = t;
              if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                void native
                  .detect(video)
                  .then((codes) => {
                    if (cancelled || !codes?.length) return;
                    for (const c of codes) {
                      if (c.rawValue) handleDecodedText(c.rawValue);
                    }
                  })
                  .catch(() => {
                    /* no barcode in frame */
                  });
              }
            }
            rafNative = requestAnimationFrame(tickNative);
          };
          rafNative = requestAnimationFrame(tickNative);
          return;
        }

        setScannerBackend('zxing');
        reader = new BrowserMultiFormatReader(zxingHints);
        reader.timeBetweenDecodingAttempts = ZXING_DECODE_INTERVAL_MS;
        await reader.decodeFromStream(stream, video, (result) => {
          if (cancelled || zxingStopping) return;
          if (result) handleDecodedText(result.getText());
        });
      } catch (e) {
        if (!cancelled) {
          setCameraError(
            e instanceof Error ? e.message : 'Camera failed',
          );
        }
      }
    })();

    return stopAll;
  }, [cameraBlocked, handleDecodedText, zxingHints]);

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

  const statusLine = !socketConnected
    ? 'Reconnecting…'
    : relayReady
      ? scannerBackend === 'native'
        ? 'Live — native scanner (center barcode in frame)'
        : scannerBackend === 'zxing'
          ? 'Live — center barcode; hold steady and use good light'
          : 'Live — starting scanner…'
      : 'Joining session… you can aim the camera now';

  return (
    <div className="barcodeScan barcodeScan--relay" aria-labelledby={headingId}>
      <div className="barcodeScan__relayBar" role="status">
        <span
          className={`barcodeScan__dot barcodeScan__dot--${
            socketConnected ? 'on' : 'off'
          }`}
          aria-hidden
        />
        {statusLine}
      </div>

      <div className="barcodeScan__stage barcodeScan__stage--fullscreen">
        <video
          ref={videoRef}
          className="barcodeScan__viewport"
          muted
          playsInline
          autoPlay
        />
        <div className="barcodeScan__reticle" aria-hidden>
          <div className="barcodeScan__reticleFrame" />
          <p className="barcodeScan__reticleHint">
            Align the full barcode inside the frame — distance like scanning a QR code
          </p>
        </div>
        {!cameraPreviewOn && !cameraError ? (
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
          <span className="barcodeScan__footerLabel">Last scan</span>
          <span className="barcodeScan__footerCode">{lastSent}</span>
          {!relayReady || !socketConnected ? (
            <span className="barcodeScan__footerNote">
              Will sync to laptop when session is live
            </span>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}

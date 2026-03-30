import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';
import type { Socket } from 'socket.io-client';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
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

const BARCODE_FORMATS: Html5QrcodeSupportedFormats[] = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.PDF_417,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

/** High resolution + back camera — html5-qrcode samples the qrbox region every frame */
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
};

let scanAudioContext: AudioContext | null = null;

function getScanAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!scanAudioContext || scanAudioContext.state === 'closed') {
    scanAudioContext = new AC();
  }
  return scanAudioContext;
}

async function unlockScanAudio(): Promise<boolean> {
  const ctx = getScanAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
  return ctx.state === 'running';
}

function playScanFeedback(): void {
  const ctx = getScanAudioContext();
  if (!ctx) return;

  const run = (): void => {
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0.0001, t0);
    master.gain.exponentialRampToValueAtTime(0.28, t0 + 0.025);
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);

    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(880, t0);
    o1.connect(master);
    o1.start(t0);
    o1.stop(t0 + 0.11);

    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(1174, t0 + 0.09);
    o2.connect(master);
    o2.start(t0 + 0.09);
    o2.stop(t0 + 0.24);
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(run).catch(() => undefined);
  } else {
    run();
  }

  try {
    navigator.vibrate?.([35, 50, 35]);
  } catch {
    /* ignore */
  }
}

export function BarcodeScanPage() {
  const headingId = useId();
  const html5RootId = useMemo(
    () => `dp-barcode-scan-${Math.random().toString(36).slice(2, 11)}`,
    [],
  );
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
  const [scannerLive, setScannerLive] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [scanBang, setScanBang] = useState(0);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const socketRef = useRef<Socket | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

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
    setScanBang((n) => n + 1);
    setLastSent(text);

    if (canSend) {
      socket!.emit(WS_SCAN, { sessionId: sid, barcode: text });
    }
  }, []);

  const cameraBlocked = !sessionId || joinError !== null;

  useEffect(() => {
    if (cameraBlocked) {
      setCameraPreviewOn(false);
      setScannerLive(false);
      return;
    }

    if (typeof document === 'undefined') return;
    const root = document.getElementById(html5RootId);
    if (!root) return;

    let alive = true;
    setCameraError(null);
    setCameraPreviewOn(false);
    setScannerLive(false);

    const scanner = new Html5Qrcode(html5RootId, {
      verbose: false,
      formatsToSupport: BARCODE_FORMATS,
      useBarCodeDetectorIfSupported: true,
    });
    scannerRef.current = scanner;

    void (async () => {
      try {
        await scanner.start(
          VIDEO_CONSTRAINTS,
          {
            fps: 30,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const w = Math.floor(viewfinderWidth * 0.96);
              const h = Math.floor(
                Math.min(viewfinderHeight * 0.55, viewfinderWidth * 0.42),
              );
              return { width: w, height: Math.max(h, 120) };
            },
            disableFlip: false,
          },
          (decodedText) => {
            if (alive) handleDecodedText(decodedText);
          },
          () => {
            /* no code in frame — expected every frame */
          },
        );

        if (!alive) {
          if (scanner.isScanning) await scanner.stop().catch(() => undefined);
          scanner.clear();
          return;
        }

        const videoEl = root.querySelector('video');
        const ms = videoEl?.srcObject;
        const mediaTrack =
          ms instanceof MediaStream ? ms.getVideoTracks()[0] : undefined;

        if (mediaTrack?.applyConstraints) {
          try {
            await mediaTrack.applyConstraints({
              advanced: [{ focusMode: 'continuous' }],
            } as unknown as MediaTrackConstraints);
          } catch {
            /* not supported */
          }
        }

        setCameraPreviewOn(true);
        setScannerLive(true);
      } catch (e) {
        if (alive) {
          setCameraError(
            e instanceof Error ? e.message : 'Camera or scanner failed',
          );
        }
      }
    })();

    return () => {
      alive = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      void (async () => {
        try {
          if (s?.isScanning) await s.stop();
          s?.clear();
        } catch {
          /* ignore */
        }
      })();
      setCameraPreviewOn(false);
      setScannerLive(false);
    };
  }, [cameraBlocked, handleDecodedText, html5RootId]);

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
      ? scannerLive
        ? 'Live — fast scan (30 fps, native detector when supported)'
        : 'Starting high-speed scanner…'
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

      <div
        className="barcodeScan__stage barcodeScan__stage--fullscreen"
        onPointerDown={() => {
          void unlockScanAudio().then((ok) => {
            if (ok) setSoundUnlocked(true);
          });
        }}
      >
        <div id={html5RootId} className="barcodeScan__html5Root" />
        <div className="barcodeScan__reticle" aria-hidden>
          <div
            className={`barcodeScan__reticleBand${
              scanBang > 0 ? ' barcodeScan__reticleBand--ping' : ''
            }`}
            key={scanBang}
          >
            <span className="barcodeScan__reticleCorner barcodeScan__reticleCorner--tl" />
            <span className="barcodeScan__reticleCorner barcodeScan__reticleCorner--tr" />
            <span className="barcodeScan__reticleCorner barcodeScan__reticleCorner--bl" />
            <span className="barcodeScan__reticleCorner barcodeScan__reticleCorner--br" />
          </div>
          <p className="barcodeScan__reticleHint">
            Hold the barcode flat inside the band. The scanner reads the center area very quickly —
            move back slightly if the image looks blurry.
          </p>
        </div>
        {cameraPreviewOn && !soundUnlocked ? (
          <div className="barcodeScan__soundHint">
            Tap the preview once to enable the scan beep
          </div>
        ) : null}
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

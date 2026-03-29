import QRCode from 'react-qr-code';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { getApiBase } from '../api/baseUrl';
import {
  WS_JOIN_SESSION,
  WS_SCAN,
  WS_SCANNER_STATUS,
  WS_SESSION_ERROR,
} from '../scannerRelay/events';
import { createScannerSocket } from '../scannerRelay/createScannerSocket';
import './ScannerHostPage.css';

type ScanRow = { barcode: string; at: number };

export function ScannerHostPage() {
  const titleId = useId();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [httpError, setHttpError] = useState<string | null>(null);
  const [scannerConnected, setScannerConnected] = useState(false);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [socketError, setSocketError] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof createScannerSocket> | null>(null);

  const scanUrl =
    sessionId === null
      ? ''
      : `${window.location.origin}/scan?sessionId=${encodeURIComponent(sessionId)}`;

  const connectScanner = useCallback(async () => {
    setBusy(true);
    setHttpError(null);
    setSocketError(null);
    setScannerConnected(false);
    setScans([]);
    try {
      const res = await fetch(`${getApiBase()}/session`, { method: 'POST' });
      if (!res.ok) {
        setHttpError(`Could not create session (${res.status})`);
        return;
      }
      const data = (await res.json()) as { sessionId?: string };
      if (!data.sessionId || typeof data.sessionId !== 'string') {
        setHttpError('Invalid session response');
        return;
      }
      setSessionId(data.sessionId);
    } catch {
      setHttpError('Network error — is the API running?');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const socket = createScannerSocket();
    socketRef.current = socket;

    const join = () => {
      socket.emit(WS_JOIN_SESSION, { sessionId, type: 'laptop' as const });
    };

    const onScannerStatus = (p: { connected?: boolean }) => {
      setScannerConnected(Boolean(p?.connected));
    };

    const onScan = (p: { barcode?: string }) => {
      const barcode = typeof p?.barcode === 'string' ? p.barcode : '';
      if (!barcode) return;
      setScans((prev) =>
        [{ barcode, at: Date.now() }, ...prev].slice(0, 60),
      );
    };

    const onSessionError = (p: { message?: string }) => {
      setSocketError(
        typeof p?.message === 'string' ? p.message : 'Session error',
      );
    };

    socket.on('connect', join);
    socket.on(WS_SCANNER_STATUS, onScannerStatus);
    socket.on(WS_SCAN, onScan);
    socket.on(WS_SESSION_ERROR, onSessionError);
    socket.connect();

    return () => {
      socket.off('connect', join);
      socket.off(WS_SCANNER_STATUS, onScannerStatus);
      socket.off(WS_SCAN, onScan);
      socket.off(WS_SESSION_ERROR, onSessionError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  return (
    <div className="scannerHost" aria-labelledby={titleId}>
      <header className="scannerHost__header">
        <h1 id={titleId} className="scannerHost__title">
          Phone barcode scanner
        </h1>
        <p className="scannerHost__sub">
          Open the QR code on your phone; scans appear here in real time.
        </p>
      </header>

      <div className="scannerHost__actions">
        <button
          type="button"
          className="scannerHost__primary"
          disabled={busy}
          onClick={connectScanner}
        >
          {busy ? 'Creating…' : 'Connect scanner'}
        </button>
        {sessionId ? (
          <button
            type="button"
            className="scannerHost__ghost"
            onClick={() => {
              socketRef.current?.disconnect();
              setSessionId(null);
              setScannerConnected(false);
              setScans([]);
              setSocketError(null);
            }}
          >
            End session
          </button>
        ) : null}
      </div>

      {httpError ? <p className="scannerHost__alert">{httpError}</p> : null}
      {socketError ? <p className="scannerHost__alert">{socketError}</p> : null}

      {sessionId ? (
        <section className="scannerHost__panel" aria-label="Pairing">
          <div
            className={`scannerHost__pill scannerHost__pill--${
              scannerConnected ? 'on' : 'off'
            }`}
          >
            {scannerConnected ? 'Scanner connected' : 'Scanner disconnected'}
          </div>
          <div className="scannerHost__qrWrap">
            <QRCode value={scanUrl} size={220} level="M" />
          </div>
          <p className="scannerHost__url">
            <span className="scannerHost__urlLabel">Scan opens</span>
            <code className="scannerHost__urlCode">{scanUrl}</code>
          </p>
        </section>
      ) : null}

      <section className="scannerHost__scans" aria-label="Scanned barcodes">
        <h2 className="scannerHost__scansTitle">Latest scans</h2>
        {scans.length === 0 ? (
          <p className="scannerHost__scansEmpty">
            Waiting for a barcode from your phone…
          </p>
        ) : (
          <ul className="scannerHost__scansList">
            {scans.map((row) => (
              <li key={`${row.at}-${row.barcode}`} className="scannerHost__scanRow">
                <span className="scannerHost__barcode">{row.barcode}</span>
                <time className="scannerHost__time" dateTime={new Date(row.at).toISOString()}>
                  {new Date(row.at).toLocaleTimeString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

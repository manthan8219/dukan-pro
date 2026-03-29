import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiBase } from '../api/baseUrl';
import { createScannerSocket } from './createScannerSocket';
import {
  WS_JOIN_SESSION,
  WS_SCAN,
  WS_SCANNER_STATUS,
  WS_SESSION_ERROR,
} from './events';

/**
 * Laptop-side pairing: creates a session, shows QR for /scan, forwards barcodes to the callback.
 */
export function useLaptopScannerRelay(onBarcode: (barcode: string) => void) {
  const onBarcodeRef = useRef(onBarcode);
  onBarcodeRef.current = onBarcode;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [starting, setStarting] = useState(false);
  const [httpError, setHttpError] = useState<string | null>(null);
  const [socketError, setSocketError] = useState<string | null>(null);

  const scanUrl = useMemo(
    () =>
      sessionId
        ? `${window.location.origin}/scan?sessionId=${encodeURIComponent(sessionId)}`
        : '',
    [sessionId],
  );

  const start = useCallback(async () => {
    setStarting(true);
    setHttpError(null);
    setSocketError(null);
    setPhoneConnected(false);
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
      setStarting(false);
    }
  }, []);

  const stop = useCallback(() => {
    setSessionId(null);
    setPhoneConnected(false);
    setSocketError(null);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const socket = createScannerSocket();

    const join = () => {
      socket.emit(WS_JOIN_SESSION, { sessionId, type: 'laptop' as const });
    };

    const onScannerStatus = (p: { connected?: boolean }) => {
      setPhoneConnected(Boolean(p?.connected));
    };

    const onScan = (p: { barcode?: string }) => {
      const barcode = typeof p?.barcode === 'string' ? p.barcode.trim() : '';
      if (barcode) onBarcodeRef.current(barcode);
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
    };
  }, [sessionId]);

  return {
    sessionId,
    scanUrl,
    phoneConnected,
    httpError,
    socketError,
    starting,
    start,
    stop,
    active: sessionId !== null,
  };
}

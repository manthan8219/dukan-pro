import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import QRCode from 'qrcode';

export type SafeQRCodeProps = {
  value: string;
  size?: number;
  style?: CSSProperties;
  className?: string;
};

/**
 * Renders a QR as a PNG data URL via `qrcode` (works reliably in Vite; avoids react-qr-code CJS interop issues).
 */
export function SafeQRCode({ value, size = 200, style, className }: SafeQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (!value.trim()) {
      setDataUrl(null);
      return;
    }
    void QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000ff', light: '#ffffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDataUrl(null);
          setError(e instanceof Error ? e.message : 'Could not generate QR code');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (error) {
    return (
      <p className={`safeQrError ${className ?? ''}`.trim()} style={style}>
        {error}
      </p>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={`safeQrPlaceholder ${className ?? ''}`.trim()}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          background: 'repeating-linear-gradient(-45deg, #f1f5f9, #f1f5f9 6px, #e2e8f0 6px, #e2e8f0 12px)',
          borderRadius: 8,
          ...style,
        }}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt="QR code — scan with your phone to open the scanner page"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', maxWidth: '100%', height: 'auto', ...style }}
    />
  );
}

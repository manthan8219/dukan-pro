import type { ComponentType, CSSProperties } from 'react';
import * as QrModule from 'react-qr-code';

type Level = 'L' | 'M' | 'Q' | 'H';

export type SafeQRCodeProps = {
  value: string;
  size?: number;
  level?: Level;
  style?: CSSProperties;
};

type InnerProps = {
  value: string;
  size?: number;
  level?: Level;
  style?: CSSProperties;
};

function pickQrComponent(): ComponentType<InnerProps> | null {
  const m = QrModule as unknown as Record<string, unknown>;
  if (typeof m.QRCode === 'function') {
    return m.QRCode as ComponentType<InnerProps>;
  }
  const d = m.default;
  if (typeof d === 'function') {
    return d as ComponentType<InnerProps>;
  }
  if (d && typeof d === 'object') {
    const nested = d as Record<string, unknown>;
    if (typeof nested.QRCode === 'function') {
      return nested.QRCode as ComponentType<InnerProps>;
    }
    if (typeof nested.default === 'function') {
      return nested.default as ComponentType<InnerProps>;
    }
  }
  return null;
}

const QrInner = pickQrComponent();

/**
 * Vite + react-qr-code (CJS): default import is sometimes the module object, which triggers React error #130.
 */
export function SafeQRCode({ value, size = 200, level = 'M', style }: SafeQRCodeProps) {
  if (!QrInner) {
    return (
      <p className="safeQrFallback" style={style}>
        {value}
      </p>
    );
  }
  return <QrInner value={value} size={size} level={level} style={style} />;
}

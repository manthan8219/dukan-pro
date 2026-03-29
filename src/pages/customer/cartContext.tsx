import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

const CART_KEY = 'dukaanpro_customer_cart_v1';

export type CartLine = {
  shopId: string;
  shopName: string;
  /** Listing id (shop_products.id); required to place orders on the API. */
  shopProductId?: string;
  productId: string;
  title: string;
  unitPrice: number;
  qty: number;
  unit: string;
};

function lineMergeKey(line: Pick<CartLine, 'shopId' | 'productId' | 'shopProductId'>): string {
  if (line.shopProductId) return `sp:${line.shopProductId}`;
  return `legacy:${line.shopId}|${line.productId}`;
}

function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const o = row as Record<string, unknown>;
        const shopId = typeof o.shopId === 'string' ? o.shopId : '';
        const shopName = typeof o.shopName === 'string' ? o.shopName : '';
        const shopProductId =
          typeof o.shopProductId === 'string' && o.shopProductId.length > 0 ? o.shopProductId : undefined;
        const productId = typeof o.productId === 'string' ? o.productId : '';
        const title = typeof o.title === 'string' ? o.title : '';
        const unitPrice = typeof o.unitPrice === 'number' && Number.isFinite(o.unitPrice) ? o.unitPrice : 0;
        const qty = typeof o.qty === 'number' && o.qty >= 1 ? Math.floor(o.qty) : 0;
        const unit = typeof o.unit === 'string' ? o.unit : '';
        if (!shopId || !productId || !title || qty < 1) return null;
        const base = { shopId, shopName, productId, title, unitPrice, qty, unit };
        return (shopProductId ? { ...base, shopProductId } : base) satisfies CartLine;
      })
      .filter((x): x is CartLine => x != null);
  } catch {
    return [];
  }
}

function writeCart(lines: CartLine[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(lines));
}

let listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((cb) => cb());
}

function setCart(lines: CartLine[]) {
  writeCart(lines);
  emit();
}

/** Stable empty cart — React 19 useSyncExternalStore requires getSnapshot to return the same ref when data is unchanged. */
const EMPTY_CART_SNAPSHOT: CartLine[] = [];

let cachedCartSnapshot: CartLine[] = EMPTY_CART_SNAPSHOT;
let cachedCartKey = '';

export function getCartSnapshot(): CartLine[] {
  const lines = readCart();
  if (lines.length === 0) {
    cachedCartKey = '';
    cachedCartSnapshot = EMPTY_CART_SNAPSHOT;
    return EMPTY_CART_SNAPSHOT;
  }
  const key = JSON.stringify(lines);
  if (key === cachedCartKey) {
    return cachedCartSnapshot;
  }
  cachedCartKey = key;
  cachedCartSnapshot = lines;
  return lines;
}

function getServerCartSnapshot(): CartLine[] {
  return EMPTY_CART_SNAPSHOT;
}

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  addItem: (line: Omit<CartLine, 'qty'> & { qty?: number }) => void;
  setQty: (shopId: string, productId: string, qty: number) => void;
  removeLine: (shopId: string, productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CustomerCartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getCartSnapshot, getServerCartSnapshot);

  const addItem = useCallback((line: Omit<CartLine, 'qty'> & { qty?: number }) => {
    const qty = line.qty ?? 1;
    const next = [...readCart()];
    const key = lineMergeKey(line);
    const i = next.findIndex((l) => lineMergeKey(l) === key);
    if (i >= 0) {
      const mergedSp = line.shopProductId ?? next[i]!.shopProductId;
      next[i] = {
        ...next[i]!,
        shopProductId: mergedSp,
        qty: next[i]!.qty + qty,
      };
    } else {
      next.push({
        shopId: line.shopId,
        shopName: line.shopName,
        shopProductId: line.shopProductId,
        productId: line.productId,
        title: line.title,
        unitPrice: line.unitPrice,
        unit: line.unit,
        qty,
      });
    }
    setCart(next);
  }, []);

  const setQty = useCallback((shopId: string, productId: string, qty: number) => {
    const cur = readCart();
    const prev = cur.find((l) => l.shopId === shopId && l.productId === productId);
    if (!prev) return;
    if (qty < 1) {
      setCart(cur.filter((l) => !(l.shopId === shopId && l.productId === productId)));
      return;
    }
    setCart(cur.map((l) => (l.shopId === shopId && l.productId === productId ? { ...l, qty } : l)));
  }, []);

  const removeLine = useCallback((shopId: string, productId: string) => {
    setCart(readCart().filter((l) => !(l.shopId === shopId && l.productId === productId)));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = lines.reduce((s, l) => s + l.qty, 0);
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    return {
      lines,
      itemCount,
      subtotal,
      addItem,
      setQty,
      removeLine,
      clearCart,
    };
  }, [lines, addItem, setQty, removeLine, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCustomerCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCustomerCart must be used under CustomerCartProvider');
  return ctx;
}

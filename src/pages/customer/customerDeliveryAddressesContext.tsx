import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserDeliveryAddress,
  deleteUserDeliveryAddress,
  listUserDeliveryAddresses,
  updateUserDeliveryAddress,
} from '../../api/userDeliveryAddresses';
import type { AddressBook, AddressTag, DeliveryAddress, SavedAddress } from './customerDeliveryTypes';
import {
  bookFromApiRows,
  clearLegacyLocalAddressBook,
  readLegacyLocalAddressBook,
} from './customerDeliveryTypes';

type CustomerDeliveryAddressesContextValue = {
  userId: string;
  book: AddressBook;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getSelectedSavedAddress: () => SavedAddress | null;
  setSelectedAddressId: (id: string) => Promise<void>;
  addSavedAddress: (
    entry: Omit<SavedAddress, 'id'> & { id?: string },
  ) => Promise<SavedAddress>;
  updateSavedAddress: (
    id: string,
    patch: Partial<Omit<SavedAddress, 'id'>>,
  ) => Promise<void>;
  removeSavedAddress: (id: string) => Promise<void>;
  /** Merge fields into the default (or only) saved address, or create one. */
  saveDeliveryAddress: (a: DeliveryAddress) => Promise<void>;
};

const CustomerDeliveryAddressesContext =
  createContext<CustomerDeliveryAddressesContextValue | null>(null);

function notifyDeliveryUpdated() {
  window.dispatchEvent(new CustomEvent('dukaanpro-delivery-updated'));
}

export function CustomerDeliveryAddressesProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [book, setBook] = useState<AddressBook>({ addresses: [], selectedId: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyRows = useCallback((rows: Awaited<ReturnType<typeof listUserDeliveryAddresses>>) => {
    setBook(bookFromApiRows(rows));
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const rows = await listUserDeliveryAddresses(userId);
      applyRows(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load addresses');
      throw e;
    }
  }, [userId, applyRows]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let rows = await listUserDeliveryAddresses(userId);
        if (!cancelled && rows.length === 0) {
          const legacy = readLegacyLocalAddressBook();
          if (legacy && legacy.addresses.length > 0) {
            const sorted = [...legacy.addresses].sort((a, b) => {
              if (a.id === legacy.selectedId) return -1;
              if (b.id === legacy.selectedId) return 1;
              return 0;
            });
            for (let i = 0; i < sorted.length; i++) {
              const a = sorted[i]!;
              await createUserDeliveryAddress(userId, {
                fullName: a.fullName,
                phone: a.phone,
                line1: a.line1,
                line2: a.line2 || undefined,
                landmark: a.landmark || undefined,
                city: a.city,
                pin: a.pin,
                tag: a.tag as AddressTag,
                label: a.tag === 'other' ? a.label : undefined,
                setAsDefault: i === 0,
              });
            }
            clearLegacyLocalAddressBook();
            rows = await listUserDeliveryAddresses(userId);
          }
        }
        if (!cancelled) {
          applyRows(rows);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load addresses');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, applyRows]);

  const getSelectedSavedAddress = useCallback((): SavedAddress | null => {
    if (book.addresses.length === 0) return null;
    const hit = book.selectedId
      ? book.addresses.find((a) => a.id === book.selectedId)
      : undefined;
    return hit ?? book.addresses[0] ?? null;
  }, [book]);

  const setSelectedAddressId = useCallback(
    async (id: string) => {
      if (!book.addresses.some((a) => a.id === id)) return;
      await updateUserDeliveryAddress(userId, id, { setAsDefault: true });
      await refresh();
      notifyDeliveryUpdated();
    },
    [book.addresses, userId, refresh],
  );

  const addSavedAddress = useCallback(
    async (entry: Omit<SavedAddress, 'id'> & { id?: string }): Promise<SavedAddress> => {
      const created = await createUserDeliveryAddress(userId, {
        fullName: entry.fullName,
        phone: entry.phone,
        line1: entry.line1,
        line2: entry.line2 || undefined,
        landmark: entry.landmark || undefined,
        city: entry.city,
        pin: entry.pin,
        tag: entry.tag,
        label: entry.tag === 'other' ? entry.label : undefined,
        setAsDefault: true,
      });
      await refresh();
      notifyDeliveryUpdated();
      return {
        id: created.id,
        tag: created.tag,
        label: created.label,
        fullName: created.fullName,
        phone: created.phone,
        line1: created.line1,
        line2: created.line2,
        landmark: created.landmark,
        city: created.city,
        pin: created.pin,
      };
    },
    [userId, refresh],
  );

  const updateSavedAddress = useCallback(
    async (id: string, patch: Partial<Omit<SavedAddress, 'id'>>) => {
      const body: Parameters<typeof updateUserDeliveryAddress>[2] = {};
      if (patch.fullName !== undefined) body.fullName = patch.fullName;
      if (patch.phone !== undefined) body.phone = patch.phone;
      if (patch.line1 !== undefined) body.line1 = patch.line1;
      if (patch.line2 !== undefined) body.line2 = patch.line2;
      if (patch.landmark !== undefined) body.landmark = patch.landmark;
      if (patch.city !== undefined) body.city = patch.city;
      if (patch.pin !== undefined) body.pin = patch.pin;
      if (patch.tag !== undefined) body.tag = patch.tag;
      if (patch.label !== undefined) body.label = patch.label;
      await updateUserDeliveryAddress(userId, id, body);
      await refresh();
      notifyDeliveryUpdated();
    },
    [userId, refresh],
  );

  const removeSavedAddress = useCallback(
    async (id: string) => {
      await deleteUserDeliveryAddress(userId, id);
      await refresh();
      notifyDeliveryUpdated();
    },
    [userId, refresh],
  );

  const saveDeliveryAddress = useCallback(
    async (a: DeliveryAddress) => {
      const sel = getSelectedSavedAddress();
      if (sel) {
        await updateSavedAddress(sel.id, {
          fullName: a.fullName,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2,
          landmark: a.landmark,
          city: a.city,
          pin: a.pin,
        });
      } else {
        await createUserDeliveryAddress(userId, {
          fullName: a.fullName,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2 || undefined,
          landmark: a.landmark || undefined,
          city: a.city,
          pin: a.pin,
          tag: 'home',
          setAsDefault: true,
        });
        await refresh();
        notifyDeliveryUpdated();
      }
    },
    [userId, getSelectedSavedAddress, updateSavedAddress, refresh],
  );

  const value = useMemo(
    () => ({
      userId,
      book,
      loading,
      error,
      refresh,
      getSelectedSavedAddress,
      setSelectedAddressId,
      addSavedAddress,
      updateSavedAddress,
      removeSavedAddress,
      saveDeliveryAddress,
    }),
    [
      userId,
      book,
      loading,
      error,
      refresh,
      getSelectedSavedAddress,
      setSelectedAddressId,
      addSavedAddress,
      updateSavedAddress,
      removeSavedAddress,
      saveDeliveryAddress,
    ],
  );

  return (
    <CustomerDeliveryAddressesContext.Provider value={value}>
      {children}
    </CustomerDeliveryAddressesContext.Provider>
  );
}

export function useCustomerDeliveryAddresses(): CustomerDeliveryAddressesContextValue {
  const ctx = useContext(CustomerDeliveryAddressesContext);
  if (!ctx) {
    throw new Error(
      'useCustomerDeliveryAddresses must be used within CustomerDeliveryAddressesProvider',
    );
  }
  return ctx;
}

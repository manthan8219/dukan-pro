import { useCallback, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCustomerDeliveryAddresses } from './customerDeliveryAddressesContext';
import type { AddressTag, DeliveryAddress, SavedAddress } from './customerDeliveryTypes';
import { deliverySummaryLine } from './customerDeliveryTypes';
import './customer-app.css';

const emptyAddr: DeliveryAddress = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  pin: '',
};

function toFields(s: SavedAddress): DeliveryAddress {
  const { id: _i, tag: _t, label: _l, ...rest } = s;
  return rest;
}

export function CustomerAddressesPage() {
  const formId = useId();
  const { book, loading, error, addSavedAddress, updateSavedAddress, removeSavedAddress, setSelectedAddressId } =
    useCustomerDeliveryAddresses();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tag, setTag] = useState<AddressTag>('home');
  const [customLabel, setCustomLabel] = useState('');
  const [fields, setFields] = useState<DeliveryAddress>({ ...emptyAddr });
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setEditingId(null);
    setTag('home');
    setCustomLabel('');
    setFields({ ...emptyAddr });
    setShowForm(true);
  }

  function openEdit(s: SavedAddress) {
    setEditingId(s.id);
    setTag(s.tag);
    setCustomLabel(s.tag === 'other' ? s.label : '');
    setFields(toFields(s));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  function updateField<K extends keyof DeliveryAddress>(key: K, value: DeliveryAddress[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const submitForm = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const labelForOther = customLabel.trim() || 'Other';
      setSaving(true);
      try {
        if (editingId) {
          await updateSavedAddress(editingId, {
            ...fields,
            tag,
            label: tag === 'other' ? labelForOther : undefined,
          });
        } else {
          await addSavedAddress({
            tag,
            label: tag === 'other' ? labelForOther : tag === 'home' ? 'Home' : 'Office',
            ...fields,
          });
        }
        closeForm();
      } catch {
        /* surfaced via error state on next load; could toast */
      } finally {
        setSaving(false);
      }
    },
    [editingId, fields, tag, customLabel, updateSavedAddress, addSavedAddress],
  );

  async function selectForDelivery(id: string) {
    try {
      await setSelectedAddressId(id);
    } catch {
      /* ignore */
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Remove this saved address?')) return;
    try {
      await removeSavedAddress(id);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <h2 className="cust__pageTitle">Delivery addresses</h2>
      <p className="cust__sub">
        Save Home, Office, or custom tags. The one marked <strong>Active</strong> is used at checkout and in the header.
        Addresses are stored on your account.
      </p>
      {error ? (
        <p className="cust__sub" role="alert" style={{ color: 'var(--cust-danger, #c62828)' }}>
          {error}
        </p>
      ) : null}

      <div className="cust__addrList">
        {loading ? (
          <p className="cust__sub">Loading addresses…</p>
        ) : book.addresses.length === 0 ? (
          <div className="cust__panel cust__addrEmpty">
            <p className="cust__sub" style={{ marginBottom: '0.75rem' }}>
              No addresses yet. Add your first one to see delivery options at checkout.
            </p>
            <button type="button" className="cust__btn cust__btn--primary cust__btn--block" onClick={openAdd}>
              Add address
            </button>
          </div>
        ) : (
          book.addresses.map((s) => {
            const active = book.selectedId === s.id;
            return (
              <div key={s.id} className={`cust__addrCard${active ? ' cust__addrCard--active' : ''}`}>
                <div className="cust__addrCardTop">
                  <span className={`cust__addrBadge cust__addrBadge--${s.tag}`}>{s.label}</span>
                  {active ? <span className="cust__addrActivePill">Active for delivery</span> : null}
                </div>
                <p className="cust__addrLines">{deliverySummaryLine(toFields(s))}</p>
                <p className="cust__addrPerson">
                  {s.fullName || '—'} · {s.phone || '—'}
                </p>
                <div className="cust__addrActions">
                  {!active ? (
                    <button
                      type="button"
                      className="cust__btn cust__btn--teal cust__btn--sm"
                      onClick={() => void selectForDelivery(s.id)}
                    >
                      Use for delivery
                    </button>
                  ) : null}
                  <button type="button" className="cust__btn cust__btn--ghost cust__btn--sm" onClick={() => openEdit(s)}>
                    Edit
                  </button>
                  <button type="button" className="cust__btn cust__btn--ghost cust__btn--sm" onClick={() => void onDelete(s.id)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!loading && book.addresses.length > 0 ? (
        <button type="button" className="cust__btn cust__btn--primary cust__btn--block" style={{ marginBottom: '1rem' }} onClick={openAdd}>
          Add another address
        </button>
      ) : null}

      {showForm ? (
        <form className="cust__panel" onSubmit={(e) => void submitForm(e)}>
          <p className="cust__sectionLabel" style={{ marginBottom: '0.65rem' }}>
            {editingId ? 'Edit address' : 'New address'}
          </p>

          <p className="cust__label">Tag</p>
          <div className="cust__tagPick" role="group" aria-label="Address tag">
            {(
              [
                ['home', 'Home'],
                ['office', 'Office'],
                ['other', 'Other'],
              ] as const
            ).map(([value, lab]) => (
              <button
                key={value}
                type="button"
                className={`cust__tagPickBtn${tag === value ? ' cust__tagPickBtn--on' : ''}`}
                onClick={() => setTag(value)}
              >
                {lab}
              </button>
            ))}
          </div>
          {tag === 'other' ? (
            <>
              <label className="cust__label" htmlFor={`${formId}-label`}>
                Label (e.g. Mom&apos;s place, Gym)
              </label>
              <input
                id={`${formId}-label`}
                className="cust__input"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Name this address"
              />
            </>
          ) : null}

          <label className="cust__label" htmlFor={`${formId}-name`}>
            Full name
          </label>
          <input
            id={`${formId}-name`}
            className="cust__input"
            value={fields.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            autoComplete="name"
            required
          />
          <label className="cust__label" htmlFor={`${formId}-phone`}>
            Phone
          </label>
          <input
            id={`${formId}-phone`}
            className="cust__input"
            value={fields.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            required
          />
          <label className="cust__label" htmlFor={`${formId}-line1`}>
            Flat / house &amp; street
          </label>
          <input
            id={`${formId}-line1`}
            className="cust__input"
            value={fields.line1}
            onChange={(e) => updateField('line1', e.target.value)}
            autoComplete="street-address"
            required
          />
          <label className="cust__label" htmlFor={`${formId}-line2`}>
            Area (optional)
          </label>
          <input
            id={`${formId}-line2`}
            className="cust__input"
            value={fields.line2}
            onChange={(e) => updateField('line2', e.target.value)}
          />
          <label className="cust__label" htmlFor={`${formId}-landmark`}>
            Landmark (optional)
          </label>
          <input
            id={`${formId}-landmark`}
            className="cust__input"
            value={fields.landmark}
            onChange={(e) => updateField('landmark', e.target.value)}
          />
          <div className="cust__row2">
            <div>
              <label className="cust__label" htmlFor={`${formId}-city`}>
                City
              </label>
              <input
                id={`${formId}-city`}
                className="cust__input"
                value={fields.city}
                onChange={(e) => updateField('city', e.target.value)}
                autoComplete="address-level2"
                required
              />
            </div>
            <div>
              <label className="cust__label" htmlFor={`${formId}-pin`}>
                PIN
              </label>
              <input
                id={`${formId}-pin`}
                className="cust__input"
                value={fields.pin}
                onChange={(e) => updateField('pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="postal-code"
                required
              />
            </div>
          </div>

          <div className="cust__addrFormActions">
            <button type="button" className="cust__btn cust__btn--ghost cust__btn--block" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className="cust__btn cust__btn--teal cust__btn--block" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save address'}
            </button>
          </div>
        </form>
      ) : null}

      <Link to="/app/customer" className="cust__back">
        ← Back to shops
      </Link>
    </>
  );
}

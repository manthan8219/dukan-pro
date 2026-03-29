export function SellerOrdersPage() {
  return (
    <div className="sdash__panel">
      <h2>Order desk</h2>
      <p>
        Your <strong>incoming orders</strong> show up here — new requests, what’s being packed, and what’s out for
        delivery. Think of it as your daily command centre for fulfilment.
      </p>
      <p style={{ marginTop: '1rem' }}>
        Planned areas: <strong>new</strong>, <strong>preparing</strong>, <strong>ready for pickup / out for delivery</strong>,{' '}
        and <strong>completed</strong> with customer notes.
      </p>
    </div>
  );
}

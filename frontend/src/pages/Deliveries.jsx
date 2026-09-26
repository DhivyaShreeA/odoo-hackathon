import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { socket } from "../lib/socket.js";
import StatusBadge from "../components/StatusBadge.jsx";

// Deliveries follow the spec's Pick -> Pack -> Validate flow. Under the hood
// this reuses the same draft/waiting/ready/done states as receipts, just
// relabeled here for what they mean on the outgoing side.
const STATUS_LABELS = { waiting: "Picking", ready: "Packed" };
const NEXT_ACTION = {
  draft: { label: "Start picking", to: "waiting" },
  waiting: { label: "Mark packed", to: "ready" },
  ready: { label: "Validate & ship →", to: "validate" },
};

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [customer, setCustomer] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState([{ product_id: "", quantity: "" }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    setDeliveries(await api(`/deliveries${qs}`));
  }

  useEffect(() => {
    load();
    api("/products").then(setProducts);
    api("/warehouses").then(setWarehouses);
    socket.on("stock:changed", load);
    return () => socket.off("stock:changed", load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function updateItem(i, patch) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/deliveries", {
        method: "POST",
        body: { customer, warehouse_id: warehouseId, items },
      });
      setCustomer("");
      setWarehouseId("");
      setItems([{ product_id: "", quantity: "" }]);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdvance(delivery) {
    setError("");
    const next = NEXT_ACTION[delivery.status];
    if (!next) return;
    try {
      if (next.to === "validate") {
        await api(`/deliveries/${delivery.id}/validate`, { method: "POST" });
      } else {
        await api(`/deliveries/${delivery.id}/status`, { method: "PATCH", body: { status: next.to } });
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCancel(delivery) {
    setError("");
    try {
      await api(`/deliveries/${delivery.id}/status`, { method: "PATCH", body: { status: "canceled" } });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Delivery Orders</h1>
          <p className="text-sm text-muted mt-1">Pick, pack, and ship stock to customers</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          {showForm ? "Cancel" : "+ New delivery"}
        </button>
      </div>

      {error && <div className="mb-4 text-sm text-danger">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-border rounded-lg p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Customer</label>
              <input
                required
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Warehouse</label>
              <select
                required
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
              >
                <option value="">Select…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">Products to ship</label>
            {items.map((item, i) => (
              <div key={i} className="flex gap-3 mb-2">
                <select
                  required
                  value={item.product_id}
                  onChange={(e) => updateItem(i, { product_id: e.target.value })}
                  className="flex-1 rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — {p.total_stock} in stock
                    </option>
                  ))}
                </select>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Quantity"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, { quantity: e.target.value })}
                  className="w-32 rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setItems([...items, { product_id: "", quantity: "" }])}
              className="text-sm text-primary hover:underline"
            >
              + Add another product
            </button>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save as draft"}
          </button>
        </form>
      )}

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-border rounded-md px-3 py-2"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="waiting">Picking</option>
          <option value="ready">Packed</option>
          <option value="done">Done</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 py-2.5 font-medium">Customer</th>
              <th className="px-5 py-2.5 font-medium">Warehouse</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium">Created</th>
              <th className="px-5 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {deliveries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted">
                  No delivery orders yet.
                </td>
              </tr>
            )}
            {deliveries.map((d) => {
              const next = NEXT_ACTION[d.status];
              const cancelable = d.status === "draft" || d.status === "waiting" || d.status === "ready";
              return (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-2.5 font-medium">{d.customer}</td>
                  <td className="px-5 py-2.5">{d.warehouse_name}</td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={d.status} labels={STATUS_LABELS} />
                  </td>
                  <td className="px-5 py-2.5 text-muted">{new Date(d.created_at * 1000).toLocaleString()}</td>
                  <td className="px-5 py-2.5 text-right whitespace-nowrap">
                    {cancelable && (
                      <button onClick={() => handleCancel(d)} className="text-sm text-muted hover:text-danger mr-4">
                        Cancel
                      </button>
                    )}
                    {next && (
                      <button
                        onClick={() => handleAdvance(d)}
                        className={`text-sm font-medium hover:underline ${
                          next.to === "validate" ? "text-good" : "text-primary"
                        }`}
                      >
                        {next.label}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

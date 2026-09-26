import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { socket } from "../lib/socket.js";
import StatusBadge from "../components/StatusBadge.jsx";

// The next available action for each status, and what it does.
const NEXT_ACTION = {
  draft: { label: "Mark as waiting", to: "waiting" },
  waiting: { label: "Mark as ready", to: "ready" },
  ready: { label: "Validate →", to: "validate" },
};

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState([{ product_id: "", quantity: "" }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    setReceipts(await api(`/receipts${qs}`));
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
      await api("/receipts", {
        method: "POST",
        body: { supplier, warehouse_id: warehouseId, items },
      });
      setSupplier("");
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

  async function handleAdvance(receipt) {
    setError("");
    const next = NEXT_ACTION[receipt.status];
    if (!next) return;
    try {
      if (next.to === "validate") {
        await api(`/receipts/${receipt.id}/validate`, { method: "POST" });
      } else {
        await api(`/receipts/${receipt.id}/status`, { method: "PATCH", body: { status: next.to } });
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCancel(receipt) {
    setError("");
    try {
      await api(`/receipts/${receipt.id}/status`, { method: "PATCH", body: { status: "canceled" } });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Receipts</h1>
          <p className="text-sm text-muted mt-1">Incoming stock from suppliers</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          {showForm ? "Cancel" : "+ New receipt"}
        </button>
      </div>

      {error && <div className="mb-4 text-sm text-danger">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-border rounded-lg p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Supplier</label>
              <input
                required
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
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
            <label className="block text-sm font-medium text-ink mb-2">Products received</label>
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
                      {p.name} ({p.sku})
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
          <option value="waiting">Waiting</option>
          <option value="ready">Ready</option>
          <option value="done">Done</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 py-2.5 font-medium">Supplier</th>
              <th className="px-5 py-2.5 font-medium">Warehouse</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium">Created</th>
              <th className="px-5 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted">
                  No receipts yet.
                </td>
              </tr>
            )}
            {receipts.map((r) => {
              const next = NEXT_ACTION[r.status];
              const cancelable = r.status === "draft" || r.status === "waiting" || r.status === "ready";
              return (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-2.5 font-medium">{r.supplier}</td>
                  <td className="px-5 py-2.5">{r.warehouse_name}</td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-2.5 text-muted">{new Date(r.created_at * 1000).toLocaleString()}</td>
                  <td className="px-5 py-2.5 text-right whitespace-nowrap">
                    {cancelable && (
                      <button onClick={() => handleCancel(r)} className="text-sm text-muted hover:text-danger mr-4">
                        Cancel
                      </button>
                    )}
                    {next && (
                      <button
                        onClick={() => handleAdvance(r)}
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

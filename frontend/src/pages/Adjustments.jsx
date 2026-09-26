import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { socket } from "../lib/socket.js";

export default function Adjustments() {
  const [adjustments, setAdjustments] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ product_id: "", warehouse_id: "", counted_quantity: "", reason: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setAdjustments(await api("/adjustments"));
  }

  useEffect(() => {
    load();
    api("/products").then(setProducts);
    api("/warehouses").then(setWarehouses);
    socket.on("stock:changed", load);
    return () => socket.off("stock:changed", load);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/adjustments", { method: "POST", body: form });
      setForm({ product_id: "", warehouse_id: "", counted_quantity: "", reason: "" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Stock Adjustments</h1>
        <p className="text-sm text-muted mt-1">Fix mismatches between recorded stock and physical count</p>
      </div>

      {error && <div className="mb-4 text-sm text-danger">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-lg p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Product</label>
          <select
            required
            value={form.product_id}
            onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
          >
            <option value="">Select…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Location</label>
          <select
            required
            value={form.warehouse_id}
            onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
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
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Counted quantity</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.counted_quantity}
            onChange={(e) => setForm({ ...form, counted_quantity: e.target.value })}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-ink mb-1">Reason</label>
            <input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Damaged"
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60 h-[38px]"
          >
            {saving ? "…" : "Adjust"}
          </button>
        </div>
      </form>

      <div className="bg-surface border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 py-2.5 font-medium">Product</th>
              <th className="px-5 py-2.5 font-medium">Location</th>
              <th className="px-5 py-2.5 font-medium">Counted</th>
              <th className="px-5 py-2.5 font-medium">Difference</th>
              <th className="px-5 py-2.5 font-medium">Reason</th>
              <th className="px-5 py-2.5 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted">
                  No adjustments yet.
                </td>
              </tr>
            )}
            {adjustments.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="px-5 py-2.5 font-medium">
                  {a.product_name} <span className="text-muted">({a.sku})</span>
                </td>
                <td className="px-5 py-2.5">{a.warehouse_name}</td>
                <td className="px-5 py-2.5">{a.counted_quantity}</td>
                <td className={`px-5 py-2.5 font-medium ${a.difference >= 0 ? "text-good" : "text-danger"}`}>
                  {a.difference >= 0 ? "+" : ""}
                  {a.difference}
                </td>
                <td className="px-5 py-2.5 text-muted">{a.reason || "—"}</td>
                <td className="px-5 py-2.5 text-muted">{new Date(a.created_at * 1000).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

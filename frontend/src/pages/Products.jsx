import { useEffect, useState } from "react";
import { AlertTriangle, Search, Pencil, PackageX } from "lucide-react";
import { api } from "../lib/api.js";
import { socket } from "../lib/socket.js";

const emptyForm = {
  name: "",
  sku: "",
  category_id: "",
  unit: "pcs",
  reorder_level: 0,
  initial_stock: 0,
  warehouse_id: "",
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadProducts() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryFilter) params.set("category_id", categoryFilter);
    const qs = params.toString();
    setProducts(await api(`/products${qs ? `?${qs}` : ""}`));
  }

  useEffect(() => {
    loadProducts();
    socket.on("stock:changed", loadProducts);
    return () => socket.off("stock:changed", loadProducts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter]);

  useEffect(() => {
    api("/warehouses").then(setWarehouses);
    api("/categories").then(setCategories);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSaving(true);
    try {
      if (editingId) {
        // Editing never touches stock/warehouse — only catalog details —
        // so those fields are simply not sent on update.
        await api(`/products/${editingId}`, {
          method: "PUT",
          body: {
            name: form.name,
            sku: form.sku,
            category_id: form.category_id,
            unit: form.unit,
            reorder_level: form.reorder_level,
          },
        });
      } else {
        await api("/products", { method: "POST", body: form });
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      loadProducts();
      api("/categories").then(setCategories); // refresh product_count
    } catch (err) {
      setError(err.message);
      if (err.details) setFieldErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku,
      category_id: p.category_id || "",
      unit: p.unit,
      reorder_level: p.reorder_level,
      initial_stock: 0,
      warehouse_id: "",
    });
    setFieldErrors({});
    setError("");
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
    setError("");
  }

  // Three-tier status: 0 stock is a distinct, more urgent state than merely
  // being at/below the reorder level.
  function stockStatus(p) {
    if (p.total_stock <= 0) return "out";
    if (p.total_stock <= p.reorder_level) return "low";
    return "in";
  }

  const outOfStockCount = products.filter((p) => stockStatus(p) === "out").length;
  const lowStockCount = products.filter((p) => stockStatus(p) === "low").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Products</h1>
          <p className="text-sm text-muted mt-1">Manage catalog, SKUs, categories, and reorder rules</p>
        </div>
        <button
          onClick={() => (showForm ? cancelForm() : setShowForm(true))}
          className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          {showForm ? "Cancel" : "+ New product"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-lg p-5 mb-6 space-y-4">
          <p className="text-sm font-medium text-ink -mt-1">{editingId ? "Edit product" : "New product"}</p>
          {error && <div className="text-sm text-danger">{error}</div>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Name" error={fieldErrors.name}>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
              />
            </Field>
            <Field label="SKU / Code" error={fieldErrors.sku}>
              <input
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="e.g. STL-001"
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
              />
            </Field>
            <Field label="Category" error={fieldErrors.category_id}>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit of measure" error={fieldErrors.unit}>
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
              />
            </Field>
            <Field label="Reorder level" error={fieldErrors.reorder_level}>
              <input
                type="number"
                min="0"
                value={form.reorder_level}
                onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
              />
            </Field>
            {!editingId && (
              <>
                <Field label="Initial stock (optional)" error={fieldErrors.initial_stock}>
                  <input
                    type="number"
                    min="0"
                    value={form.initial_stock}
                    onChange={(e) => setForm({ ...form, initial_stock: e.target.value })}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
                  />
                </Field>
                <Field label="Warehouse" error={fieldErrors.warehouse_id}>
                  <select
                    value={form.warehouse_id}
                    onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
                  >
                    <option value="">Default</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {editingId && (
              <p className="col-span-2 md:col-span-3 text-xs text-muted -mt-1">
                Stock quantity isn't edited here — use Receipts, Deliveries, Transfers, or Adjustments to change it.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : editingId ? "Save changes" : "Save product"}
          </button>
        </form>
      )}

      {(outOfStockCount > 0 || lowStockCount > 0) && (
        <div className="mb-4 flex flex-wrap gap-3">
          {outOfStockCount > 0 && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/25 text-danger text-sm font-medium rounded-md px-4 py-2.5">
              <PackageX size={16} />
              {outOfStockCount} product{outOfStockCount === 1 ? "" : "s"} out of stock
            </div>
          )}
          {lowStockCount > 0 && (
            <div className="flex items-center gap-2 bg-accent/10 border border-accent/25 text-accent text-sm font-medium rounded-md px-4 py-2.5">
              <AlertTriangle size={16} />
              {lowStockCount} product{lowStockCount === 1 ? "" : "s"} low on stock
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-full rounded-md border border-border pl-9 pr-3 py-2 text-sm focus:border-primary"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm border border-border rounded-md px-3 py-2"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 py-2.5 font-medium">Name</th>
              <th className="px-5 py-2.5 font-medium">SKU</th>
              <th className="px-5 py-2.5 font-medium">Category</th>
              <th className="px-5 py-2.5 font-medium">Unit</th>
              <th className="px-5 py-2.5 font-medium">Stock</th>
              <th className="px-5 py-2.5 font-medium">Reorder level</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-muted">
                  No products yet. Add your first one above.
                </td>
              </tr>
            )}
            {products.map((p) => {
              const status = stockStatus(p);
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-2.5 font-medium">{p.name}</td>
                  <td className="px-5 py-2.5 text-muted">{p.sku}</td>
                  <td className="px-5 py-2.5 text-muted">{p.category_name || "—"}</td>
                  <td className="px-5 py-2.5">{p.unit}</td>
                  <td className="px-5 py-2.5">{p.total_stock}</td>
                  <td className="px-5 py-2.5">{p.reorder_level}</td>
                  <td className="px-5 py-2.5">
                    {status === "out" && (
                      <span className="inline-flex items-center gap-1 bg-danger/15 text-danger text-xs font-medium px-2 py-0.5 rounded">
                        <PackageX size={11} /> Out of stock
                      </span>
                    )}
                    {status === "low" && (
                      <span className="inline-flex items-center gap-1 bg-accent/15 text-accent text-xs font-medium px-2 py-0.5 rounded">
                        <AlertTriangle size={11} /> Low stock
                      </span>
                    )}
                    {status === "in" && (
                      <span className="inline-block bg-good/15 text-good text-xs font-medium px-2 py-0.5 rounded">
                        In stock
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <button
                      onClick={() => startEdit(p)}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Pencil size={13} /> Edit
                    </button>
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

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-danger mt-1">{error[0]}</p>}
    </div>
  );
}

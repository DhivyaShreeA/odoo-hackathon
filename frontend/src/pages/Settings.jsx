import { useEffect, useState } from "react";
import { Warehouse, Tag, Trash2 } from "lucide-react";
import { api } from "../lib/api.js";

export default function Settings() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="text-sm text-muted mt-1">Manage warehouses and product categories</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WarehousesPanel />
        <CategoriesPanel />
      </div>
    </div>
  );
}

function WarehousesPanel() {
  const [warehouses, setWarehouses] = useState([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setWarehouses(await api("/warehouses"));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/warehouses", { method: "POST", body: { name, location } });
      setName("");
      setLocation("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-lg">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Warehouse size={17} className="text-primary" />
        <h2 className="font-semibold text-ink">Warehouses & Locations</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-5 border-b border-border space-y-3">
        {error && <div className="text-sm text-danger">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Warehouse"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Building B, Floor 2"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60"
        >
          {saving ? "Adding…" : "Add warehouse"}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 py-2.5 font-medium">Name</th>
              <th className="px-5 py-2.5 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-6 text-center text-muted">
                  No warehouses yet.
                </td>
              </tr>
            )}
            {warehouses.map((w) => (
              <tr key={w.id} className="border-b border-border last:border-0">
                <td className="px-5 py-2.5 font-medium">{w.name}</td>
                <td className="px-5 py-2.5 text-muted">{w.location || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoriesPanel() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setCategories(await api("/categories"));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/categories", { method: "POST", body: { name } });
      setName("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setError("");
    try {
      await api(`/categories/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-lg">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Tag size={17} className="text-primary" />
        <h2 className="font-semibold text-ink">Product Categories</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-5 border-b border-border space-y-3">
        {error && <div className="text-sm text-danger">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Category name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Raw Materials"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-60"
        >
          {saving ? "Adding…" : "Add category"}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="px-5 py-2.5 font-medium">Name</th>
              <th className="px-5 py-2.5 font-medium">Products</th>
              <th className="px-5 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-muted">
                  No categories yet.
                </td>
              </tr>
            )}
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-5 py-2.5 font-medium">{c.name}</td>
                <td className="px-5 py-2.5 text-muted">{c.product_count}</td>
                <td className="px-5 py-2.5 text-right">
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={c.product_count > 0}
                    title={c.product_count > 0 ? "Remove products from this category first" : "Delete category"}
                    className="text-danger disabled:text-muted disabled:cursor-not-allowed hover:opacity-70"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

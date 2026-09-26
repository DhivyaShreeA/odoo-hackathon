import { useEffect, useState } from "react";
import {
  Boxes,
  AlertTriangle,
  PackageX,
  PackagePlus,
  Truck,
  ArrowLeftRight,
} from "lucide-react";
import { api } from "../lib/api.js";
import { socket } from "../lib/socket.js";
import KpiCard from "../components/KpiCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

const DOC_TYPE_LABELS = { receipt: "Receipt", delivery: "Delivery", internal: "Internal", adjustment: "Adjustment" };

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ type: "", warehouse_id: "", category_id: "" });
  const [docFilters, setDocFilters] = useState({ type: "", status: "", warehouse_id: "", category_id: "" });
  const [error, setError] = useState("");

  async function load() {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set("type", filters.type);
      if (filters.warehouse_id) params.set("warehouse_id", filters.warehouse_id);
      if (filters.category_id) params.set("category_id", filters.category_id);
      const qs = params.toString();

      const docParams = new URLSearchParams();
      if (docFilters.type) docParams.set("type", docFilters.type);
      if (docFilters.status) docParams.set("status", docFilters.status);
      if (docFilters.warehouse_id) docParams.set("warehouse_id", docFilters.warehouse_id);
      if (docFilters.category_id) docParams.set("category_id", docFilters.category_id);
      const docQs = docParams.toString();

      const [k, l, low, docs] = await Promise.all([
        api("/dashboard/kpis"),
        api(`/dashboard/ledger${qs ? `?${qs}` : ""}`),
        api("/products/low-stock"),
        api(`/dashboard/documents${docQs ? `?${docQs}` : ""}`),
      ]);
      setKpis(k);
      setLedger(l);
      setLowStock(low);
      setDocuments(docs);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // Live update: any receipt/delivery/transfer/adjustment validated by
    // anyone, on any machine, refreshes this dashboard immediately.
    socket.on("stock:changed", load);
    return () => socket.off("stock:changed", load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, docFilters]);

  useEffect(() => {
    api("/warehouses").then(setWarehouses);
    api("/categories").then(setCategories);
  }, []);

  const outOfStock = lowStock.filter((p) => p.status === "out_of_stock");
  const trulyLowStock = lowStock.filter((p) => p.status === "low_stock");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Live snapshot of inventory operations</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-good font-medium">
          <span className="w-2 h-2 rounded-full bg-good animate-pulse" /> Live
        </span>
      </div>

      {error && <div className="mb-4 text-sm text-danger">{error}</div>}

      {(outOfStock.length > 0 || trulyLowStock.length > 0) && (
        <div className="mb-6 space-y-3">
          {outOfStock.length > 0 && (
            <div className="bg-danger/10 border border-danger/25 rounded-lg px-5 py-3.5 flex items-start gap-3">
              <PackageX size={18} className="text-danger shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-ink">
                  {outOfStock.length} product{outOfStock.length === 1 ? " is" : "s are"} completely out of stock
                </p>
                <p className="text-muted mt-0.5">
                  {outOfStock
                    .slice(0, 4)
                    .map((p) => p.name)
                    .join(", ")}
                  {outOfStock.length > 4 ? `, and ${outOfStock.length - 4} more` : ""} — zero units on hand.
                </p>
              </div>
            </div>
          )}
          {trulyLowStock.length > 0 && (
            <div className="bg-accent/10 border border-accent/25 rounded-lg px-5 py-3.5 flex items-start gap-3">
              <AlertTriangle size={18} className="text-accent shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-ink">
                  {trulyLowStock.length} product{trulyLowStock.length === 1 ? " needs" : "s need"} reordering soon
                </p>
                <p className="text-muted mt-0.5">
                  {trulyLowStock
                    .slice(0, 4)
                    .map((p) => p.name)
                    .join(", ")}
                  {trulyLowStock.length > 4 ? `, and ${trulyLowStock.length - 4} more` : ""} — at or below reorder
                  level, but not yet empty.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <KpiCard label="Total Products" value={kpis.totalProducts} icon={Boxes} />
          <KpiCard
            label="Low Stock"
            value={kpis.lowStock}
            tone={kpis.lowStock > 0 ? "warning" : "default"}
            icon={AlertTriangle}
          />
          <KpiCard
            label="Out of Stock"
            value={kpis.outOfStock}
            tone={kpis.outOfStock > 0 ? "danger" : "default"}
            icon={PackageX}
          />
          <KpiCard label="Pending Receipts" value={kpis.pendingReceipts} icon={PackagePlus} />
          <KpiCard label="Pending Deliveries" value={kpis.pendingDeliveries} icon={Truck} />
          <KpiCard label="Transfers Today" value={kpis.transfersToday} icon={ArrowLeftRight} />
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-ink">Operations</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={docFilters.type}
              onChange={(e) => setDocFilters({ ...docFilters, type: e.target.value })}
              className="text-sm border border-border rounded-md px-2 py-1.5"
            >
              <option value="">All document types</option>
              <option value="receipt">Receipts</option>
              <option value="delivery">Delivery</option>
              <option value="internal">Internal</option>
              <option value="adjustment">Adjustments</option>
            </select>
            <select
              value={docFilters.status}
              onChange={(e) => setDocFilters({ ...docFilters, status: e.target.value })}
              className="text-sm border border-border rounded-md px-2 py-1.5"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="waiting">Waiting</option>
              <option value="ready">Ready</option>
              <option value="done">Done</option>
              <option value="canceled">Canceled</option>
            </select>
            <select
              value={docFilters.warehouse_id}
              onChange={(e) => setDocFilters({ ...docFilters, warehouse_id: e.target.value })}
              className="text-sm border border-border rounded-md px-2 py-1.5"
            >
              <option value="">All warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <select
              value={docFilters.category_id}
              onChange={(e) => setDocFilters({ ...docFilters, category_id: e.target.value })}
              className="text-sm border border-border rounded-md px-2 py-1.5"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-5 py-2.5 font-medium">Type</th>
                <th className="px-5 py-2.5 font-medium">Reference</th>
                <th className="px-5 py-2.5 font-medium">Warehouse</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    No operations match these filters.
                  </td>
                </tr>
              )}
              {documents.map((doc) => (
                <tr key={`${doc.type}-${doc.id}`} className="border-b border-border last:border-0">
                  <td className="px-5 py-2.5">{DOC_TYPE_LABELS[doc.type] || doc.type}</td>
                  <td className="px-5 py-2.5 font-medium">{doc.reference}</td>
                  <td className="px-5 py-2.5">{doc.warehouse_name}</td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-5 py-2.5 text-muted">{new Date(doc.created_at * 1000).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-ink">Move History (Stock Ledger)</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="text-sm border border-border rounded-md px-2 py-1.5"
            >
              <option value="">All movement types</option>
              <option value="receipt">Receipts</option>
              <option value="delivery">Deliveries</option>
              <option value="transfer_out">Transfers out</option>
              <option value="transfer_in">Transfers in</option>
              <option value="adjustment">Adjustments</option>
            </select>
            <select
              value={filters.warehouse_id}
              onChange={(e) => setFilters({ ...filters, warehouse_id: e.target.value })}
              className="text-sm border border-border rounded-md px-2 py-1.5"
            >
              <option value="">All warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <select
              value={filters.category_id}
              onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
              className="text-sm border border-border rounded-md px-2 py-1.5"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="px-5 py-2.5 font-medium">Product</th>
                <th className="px-5 py-2.5 font-medium">Warehouse</th>
                <th className="px-5 py-2.5 font-medium">Type</th>
                <th className="px-5 py-2.5 font-medium">Change</th>
                <th className="px-5 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    No stock movements yet — validate a receipt or delivery to see it appear here live.
                  </td>
                </tr>
              )}
              {ledger.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-2.5">
                    {row.product_name} <span className="text-muted">({row.sku})</span>
                  </td>
                  <td className="px-5 py-2.5">{row.warehouse_name}</td>
                  <td className="px-5 py-2.5 capitalize">{row.type.replace("_", " ")}</td>
                  <td className={`px-5 py-2.5 font-medium ${row.quantity_change >= 0 ? "text-good" : "text-danger"}`}>
                    {row.quantity_change >= 0 ? "+" : ""}
                    {row.quantity_change}
                  </td>
                  <td className="px-5 py-2.5 text-muted">
                    {new Date(row.created_at * 1000).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

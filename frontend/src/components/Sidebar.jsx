import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  PackagePlus,
  Truck,
  ArrowLeftRight,
  ClipboardList,
  Settings as SettingsIcon,
  LogOut,
  Boxes,
} from "lucide-react";
import { getUser, setToken, setUser } from "../lib/api.js";

const navItems = [
  { to: "/", label: "Dashboard", end: true, icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/receipts", label: "Receipts", icon: PackagePlus },
  { to: "/deliveries", label: "Delivery Orders", icon: Truck },
  { to: "/transfers", label: "Internal Transfers", icon: ArrowLeftRight },
  { to: "/adjustments", label: "Adjustments", icon: ClipboardList },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const user = getUser();

  function handleLogout() {
    setToken(null);
    setUser(null);
    navigate("/login");
  }

  return (
    <aside className="w-64 shrink-0 bg-ink text-white flex flex-col h-screen sticky top-0">
      <div className="px-6 py-5 border-b border-white/10 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0">
          <Boxes size={18} strokeWidth={2.25} />
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight leading-none">StockSense</p>
          <p className="text-xs text-white/50 mt-1">Inventory Management</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon size={17} strokeWidth={2} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? "bg-primary text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`
          }
        >
          <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-semibold shrink-0">
            {user?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="truncate">{user?.name || "My Profile"}</span>
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 text-left rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={17} strokeWidth={2} />
          Logout
        </button>
      </div>
    </aside>
  );
}

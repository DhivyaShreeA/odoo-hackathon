import { Boxes, PackagePlus, Truck, ArrowLeftRight, ClipboardCheck } from "lucide-react";

const FEATURES = [
  { icon: PackagePlus, text: "Log incoming stock the moment it arrives" },
  { icon: Truck, text: "Pick, pack, and ship without losing count" },
  { icon: ArrowLeftRight, text: "Move stock between warehouses in one step" },
  { icon: ClipboardCheck, text: "Every movement lands in one shared ledger" },
];

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex bg-canvas">
      <div className="hidden lg:flex lg:w-[44%] bg-ink text-white flex-col justify-between p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
            <Boxes size={20} strokeWidth={2.25} />
          </div>
          <span className="text-xl font-semibold tracking-tight">StockSense</span>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-semibold leading-tight max-w-sm">
            One system for every unit that moves through your warehouse.
          </h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/75 text-sm">
                <span className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <Icon size={15} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">Replaces spreadsheets and paper registers.</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

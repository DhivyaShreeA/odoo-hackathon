export default function KpiCard({ label, value, tone = "default", icon: Icon }) {
  const toneClasses = {
    default: { value: "text-ink", iconWrap: "bg-primary/10 text-primary" },
    warning: { value: "text-accent", iconWrap: "bg-accent/15 text-accent" },
    danger: { value: "text-danger", iconWrap: "bg-danger/15 text-danger" },
  };
  const tones = toneClasses[tone] || toneClasses.default;

  return (
    <div
      className={`bg-surface border rounded-lg p-5 ${
        tone === "warning" ? "border-accent/30" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted font-medium">{label}</p>
        {Icon && (
          <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${tones.iconWrap}`}>
            <Icon size={16} strokeWidth={2.25} />
          </span>
        )}
      </div>
      <p className={`mt-3 text-3xl font-semibold ${tones.value}`}>{value}</p>
    </div>
  );
}

const STYLES = {
  draft: "bg-border/60 text-muted",
  waiting: "bg-accent/15 text-accent",
  ready: "bg-primary/15 text-primary",
  done: "bg-good/15 text-good",
  canceled: "bg-danger/15 text-danger line-through decoration-1",
};

const LABELS = {
  draft: "Draft",
  waiting: "Waiting",
  ready: "Ready",
  done: "Done",
  canceled: "Canceled",
};

// `labels` lets a page override wording per-context, e.g. deliveries call
// "waiting" -> "Picking" and "ready" -> "Packed" to match the pick/pack flow.
export default function StatusBadge({ status, labels = {} }) {
  const text = labels[status] || LABELS[status] || status;
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${STYLES[status] || "bg-border text-muted"}`}>
      {text}
    </span>
  );
}

export function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left until `iso` (never negative). */
export function daysUntil(iso) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS));
}

/** "in 28 days", "tomorrow", "today" */
export function daysLeftLabel(iso) {
  const days = daysUntil(iso);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** "just now", "5m ago", "yesterday", "3d ago", "on Oct 3" */
export function timeAgo(iso) {
  const relative = formatRelative(iso);
  if (relative === "now") return "just now";
  if (relative === "Yesterday") return "yesterday";
  if (/^\d+[mhd]$/.test(relative)) return `${relative} ago`;
  return `on ${relative}`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

/** Groups conversations into Today / Yesterday / Previous 7 days / Older, newest first. */
export function groupByDate(conversations) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();

  const labelFor = (iso) => {
    const time = iso ? new Date(iso).getTime() : 0;
    if (time >= today) return "Today";
    if (time >= today - DAY_MS) return "Yesterday";
    if (time >= today - 7 * DAY_MS) return "Previous 7 days";
    return "Older";
  };

  const groups = [];
  for (const conversation of conversations) {
    const label = labelFor(conversation.updated_at);
    const group = groups.find((item) => item.label === label);
    if (group) group.items.push(conversation);
    else groups.push({ label, items: [conversation] });
  }
  return groups;
}

export function formatRelative(iso) {
  if (!iso) return "";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

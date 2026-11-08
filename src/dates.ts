export function today(): string {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}
export function formatDate(value: string, year = false): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (!Number.isFinite(date.getTime())) return "თარიღი უცნობია";
  return new Intl.DateTimeFormat("ka-GE", {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
  }).format(date);
}
export function ageMonths(birth: string, now = new Date()): number {
  const date = new Date(`${birth}T12:00:00`);
  return Math.max(
    0,
    (now.getFullYear() - date.getFullYear()) * 12 +
      now.getMonth() -
      date.getMonth() -
      (now.getDate() < date.getDate() ? 1 : 0),
  );
}
export function ageLabel(birth: string): string {
  const months = ageMonths(birth);
  if (months < 1) return "1 თვემდე";
  return months < 12
    ? `${months} თვის`
    : `${Math.floor(months / 12)} წლის${months % 12 ? `, ${months % 12} თვის` : ""}`;
}
export function daysUntil(value: string, from = today()): number {
  return Math.round(
    (Date.parse(`${value}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}
export function countdown(value: string): {
  label: string;
  tone: "rose" | "amber" | "sage";
} {
  const days = daysUntil(value);
  if (days < 0)
    return { label: `${Math.abs(days)} დღით გადაცილებული`, tone: "rose" };
  if (days === 0) return { label: "დღეს", tone: "amber" };
  return { label: `${days} დღეში`, tone: days <= 30 ? "amber" : "sage" };
}

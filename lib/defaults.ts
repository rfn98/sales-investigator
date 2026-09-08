export const DEFAULT_END_DATE = "2026-09-07";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidEndDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime());
}

export function parseEndDate(value: unknown): string {
  if (typeof value === "string" && isValidEndDate(value)) return value;
  return DEFAULT_END_DATE;
}
export function formatCompactIDR(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000) {
    return `${sign}Rp${(absValue / 1_000_000).toFixed(2)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}Rp${(absValue / 1_000).toFixed(0)}K`;
  }
  return `${sign}Rp${absValue.toFixed(0)}`;
}

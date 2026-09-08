export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function toPercent(value: number, digits = 2): number {
  return round(value * 100, digits);
}

/**
 * Deterministic 32-bit FNV-1a hash rendered as lowercase hex. Used to derive
 * stable investigation ids so results are reproducible across runs.
 */
export function stableHash(input: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
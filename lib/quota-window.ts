const HOUR_MS = 60 * 60 * 1000;

export function sanitizeRefillIntervalHours(value: unknown, fallback = 12): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.max(1, Math.floor(num));
}

export function getQuotaWindow(now: Date, refillIntervalHours: number) {
  const interval = sanitizeRefillIntervalHours(refillIntervalHours);
  const intervalMs = interval * HOUR_MS;
  const startMs = Math.floor(now.getTime() / intervalMs) * intervalMs;
  const endMs = startMs + intervalMs;

  return {
    start: new Date(startMs),
    end: new Date(endMs),
    refillIntervalHours: interval,
  };
}


/**
 * Minimal telemetry utility
 * In production, wire this to your analytics/logging backend.
 * For now, logs to console and keeps an in-memory ring buffer for debugging.
 */

type TelemetryEvent = {
  name: string;
  level?: 'info' | 'warn' | 'error';
  props?: Record<string, any>;
  ts: number;
};

const buffer: TelemetryEvent[] = [];
const MAX = 200;

export function track(name: string, props?: Record<string, any>, level: 'info' | 'warn' | 'error' = 'info') {
  const evt: TelemetryEvent = { name, level, props, ts: Date.now() };
  buffer.push(evt);
  while (buffer.length > MAX) buffer.shift();

  const prefix = `[telemetry:${level}]`;
  if (level === 'error') console.error(prefix, name, props || {});
  else if (level === 'warn') console.warn(prefix, name, props || {});
  else console.log(prefix, name, props || {});
}

export function recentEvents(limit = 50): TelemetryEvent[] {
  return buffer.slice(-limit);
}

export function clearEvents() {
  buffer.splice(0, buffer.length);
}

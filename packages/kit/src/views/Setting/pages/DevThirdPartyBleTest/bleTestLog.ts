import { HardwareErrorCode as HwkCode } from '@onekeyfe/hwk-adapter-core';

import type { IBleTestVerdict } from './scenarios';

export type IBleTestFailure = {
  code?: number;
  message: string;
  params?: Record<string, unknown>;
  className?: string;
};

export type IBleTestLogEntry = {
  id: number;
  at: number;
  level: 'info' | 'ok' | 'fail' | 'event';
  scenarioId?: string;
  action: string;
  text: string;
  durationMs?: number;
  failure?: IBleTestFailure;
  /** What the app shows for this failure, after converting its code. */
  userFacing?: string;
  verdict?: IBleTestVerdict;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const toCode = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  return undefined;
};

const firstText = (...values: unknown[]) =>
  values.find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );

/**
 * Accepts an SDK failure payload (`{ error, code, params }`) or an app error
 * converted from one, whose SDK code sits in `payload.code`.
 */
export function describeFailure(source: unknown): IBleTestFailure {
  const record = asRecord(source);
  if (!record) return { message: String(source) };
  const payload = asRecord(record.payload);
  return {
    code: toCode(payload?.code) ?? toCode(record.code),
    message:
      firstText(record.error, record.message, payload?.message) ??
      'Unknown error',
    params: asRecord(payload?.params) ?? asRecord(record.params),
    className: firstText(record.className, record.name),
  };
}

export function formatCode(code: number | undefined): string {
  if (code === undefined) return 'no code';
  const name = HwkCode[code] as string | undefined;
  return name ? `${code} ${name}` : String(code);
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

export function formatClock(at: number): string {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}.${pad(date.getMilliseconds(), 3)}`;
}

const VERDICT_TEXT: Record<IBleTestVerdict, string> = {
  pass: '✅ 符合预期',
  mismatch: '❌ 不符合预期',
};

export function formatLogLine(entry: IBleTestLogEntry): string {
  const parts = [
    `[${formatClock(entry.at)}]`,
    entry.scenarioId ? `[${entry.scenarioId}]` : '',
    entry.action,
    entry.text,
  ];
  if (entry.durationMs !== undefined) {
    parts.push(`${(entry.durationMs / 1000).toFixed(1)}s`);
  }
  if (entry.failure) {
    parts.push(formatCode(entry.failure.code));
    if (entry.failure.params) {
      parts.push(`params=${JSON.stringify(entry.failure.params)}`);
    }
    parts.push(`message="${entry.failure.message}"`);
  }
  if (entry.userFacing) parts.push(`提示="${entry.userFacing}"`);
  if (entry.verdict) parts.push(VERDICT_TEXT[entry.verdict]);
  return parts.filter(Boolean).join(' ');
}

export function formatLogText(
  header: string[],
  entries: IBleTestLogEntry[],
): string {
  return [...header, '', ...entries.map(formatLogLine)].join('\n');
}

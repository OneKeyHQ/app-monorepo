import chalk from 'chalk';
import type { ErrorDetail } from '../errors';

export function formatHumanSuccess<T>(data: T): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) => `  ${chalk.gray(key + ':')} ${String(value)}`)
      .join('\n');
  }
  return String(data);
}

export function formatHumanError(error: ErrorDetail): string {
  return [
    chalk.red(`Error [${error.code}]: ${error.message}`),
    chalk.yellow(`  Suggestion: ${error.suggestion}`),
  ].join('\n');
}

export function formatHumanWarning(message: string): string {
  return chalk.yellow(`Warning: ${message}`);
}

export function formatHumanInfo(message: string): string {
  return chalk.blue(message);
}

import chalk from 'chalk';

import type { IErrorDetail } from '../errors';

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return chalk.dim('—');
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatObject(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .map(([key, value]) => `  ${chalk.gray(`${key}:`)} ${formatValue(value)}`)
    .join('\n');
}

export function formatHumanSuccess<T>(data: T): string {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) {
    if (data.length === 0) return chalk.dim('(no results)');
    return data
      .map((item, i) => {
        const header = chalk.cyan(`[${i}]`);
        if (typeof item === 'object' && item !== null) {
          return `${header}\n${formatObject(item as Record<string, unknown>)}`;
        }
        return `${header} ${formatValue(item)}`;
      })
      .join('\n');
  }
  if (data && typeof data === 'object') {
    return formatObject(data as Record<string, unknown>);
  }
  return String(data);
}

export function formatHumanError(error: IErrorDetail): string {
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

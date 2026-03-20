import type { OutputMode, OutputMetadata } from '../types';
import type { ErrorDetail } from '../errors';
import { formatSuccess, formatError } from './json-formatter';
import { formatHumanSuccess, formatHumanError, formatHumanWarning, formatHumanInfo } from './human-formatter';

export class OutputFormatter {
  constructor(private mode: OutputMode) {}

  success<T>(data: T, metadata?: Partial<OutputMetadata>): void {
    if (this.mode === 'quiet') {
      if (data && typeof data === 'object') {
        const values = Object.values(data as Record<string, unknown>);
        if (values.length > 0) {
          process.stdout.write(String(values[0]) + '\n');
        }
      } else {
        process.stdout.write(String(data) + '\n');
      }
      return;
    }

    if (this.mode === 'agent') {
      const response = formatSuccess(data, metadata);
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    const output = formatHumanSuccess(data);
    process.stdout.write(output + '\n');
  }

  error(error: ErrorDetail): void {
    if (this.mode === 'quiet') {
      process.stderr.write(`${error.code}: ${error.message}\n`);
      return;
    }

    if (this.mode === 'agent') {
      const response = formatError(error);
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    const output = formatHumanError(error);
    process.stderr.write(output + '\n');
  }

  warn(message: string): void {
    if (this.mode !== 'human') return;
    process.stderr.write(formatHumanWarning(message) + '\n');
  }

  info(message: string): void {
    if (this.mode !== 'human') return;
    process.stderr.write(formatHumanInfo(message) + '\n');
  }

  getMode(): OutputMode {
    return this.mode;
  }
}

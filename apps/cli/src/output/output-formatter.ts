import {
  formatHumanError,
  formatHumanInfo,
  formatHumanSuccess,
  formatHumanWarning,
} from './human-formatter';
import { formatError, formatSuccess } from './json-formatter';

import type { IErrorDetail } from '../errors';
import type { IOutputMetadata, IOutputMode } from '../types';

export class OutputFormatter {
  // eslint-disable-next-line no-useless-constructor, no-empty-function
  constructor(private mode: IOutputMode) {}

  raw(message: string, stream: 'stdout' | 'stderr' = 'stdout'): void {
    const target = stream === 'stderr' ? process.stderr : process.stdout;
    target.write(message.endsWith('\n') ? message : `${message}\n`);
  }

  success<T>(data: T, metadata?: Partial<IOutputMetadata>): void {
    if (this.mode === 'quiet') {
      if (data && typeof data === 'object') {
        const values = Object.values(data as Record<string, unknown>);
        if (values.length > 0) {
          process.stdout.write(`${String(values[0])}\n`);
        }
      } else {
        process.stdout.write(`${String(data)}\n`);
      }
      return;
    }

    if (this.mode === 'agent') {
      const response = formatSuccess(data, metadata);
      process.stdout.write(`${JSON.stringify(response)}\n`);
      return;
    }

    const output = formatHumanSuccess(data);
    process.stdout.write(`${output}\n`);
  }

  error(error: IErrorDetail): void {
    if (this.mode === 'quiet') {
      process.stderr.write(`${error.code}: ${error.message}\n`);
      return;
    }

    if (this.mode === 'agent') {
      const response = formatError(error);
      process.stdout.write(`${JSON.stringify(response)}\n`);
      return;
    }

    const output = formatHumanError(error);
    process.stderr.write(`${output}\n`);
  }

  warn(message: string): void {
    if (this.mode !== 'human') return;
    process.stderr.write(`${formatHumanWarning(message)}\n`);
  }

  info(message: string): void {
    if (this.mode !== 'human') return;
    process.stderr.write(`${formatHumanInfo(message)}\n`);
  }

  getMode(): IOutputMode {
    return this.mode;
  }
}

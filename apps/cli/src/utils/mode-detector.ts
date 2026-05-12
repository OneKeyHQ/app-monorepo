import type { IOutputMode } from '../types';

export interface IModeDetectorOptions {
  format?: 'json' | 'text';
  json?: boolean;
  interactive?: boolean;
  quiet?: boolean;
}

export function detectOutputMode(options: IModeDetectorOptions): IOutputMode {
  if (options.quiet) return 'quiet';
  if (options.format === 'text') return 'text';
  if (options.json || options.format === 'json') return 'agent';
  if (options.interactive) return 'human';
  return process.stdout.isTTY ? 'human' : 'agent';
}

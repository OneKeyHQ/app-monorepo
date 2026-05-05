import type { IOutputMode } from '../types';

export interface IModeDetectorOptions {
  json?: boolean;
  interactive?: boolean;
  quiet?: boolean;
}

export function detectOutputMode(options: IModeDetectorOptions): IOutputMode {
  if (options.quiet) return 'quiet';
  if (options.json) return 'agent';
  if (options.interactive) return 'human';
  return process.stdout.isTTY ? 'human' : 'agent';
}

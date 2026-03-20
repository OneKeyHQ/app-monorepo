import type { OutputMode } from '../types';

export interface ModeDetectorOptions {
  json?: boolean;
  interactive?: boolean;
  quiet?: boolean;
}

export function detectOutputMode(options: ModeDetectorOptions): OutputMode {
  if (options.quiet) return 'quiet';
  if (options.json) return 'agent';
  if (options.interactive) return 'human';
  return process.stdout.isTTY ? 'human' : 'agent';
}

import type { IXmrRuntimeError } from './types';

/** Runtime errors cross the boundary as JSON strings; anything else returns null. */
export function readXmrRuntimeError(error: unknown): IXmrRuntimeError | null {
  let raw: string | null = null;
  if (typeof error === 'string') {
    raw = error;
  } else if (error instanceof Error) {
    raw = error.message;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as IXmrRuntimeError).code === 'string'
    ) {
      return parsed as IXmrRuntimeError;
    }
  } catch {
    // Not a runtime error.
  }
  return null;
}

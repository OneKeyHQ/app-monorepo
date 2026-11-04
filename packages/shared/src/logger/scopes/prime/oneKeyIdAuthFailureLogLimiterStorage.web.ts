import type { IOneKeyIdAuthFailureLogLimiterStorage } from './oneKeyIdAuthFailureLogLimiterStorage';

export type { IOneKeyIdAuthFailureLogLimiterStorage } from './oneKeyIdAuthFailureLogLimiterStorage';

// Web storage survives a renderer reload (desktop, web, extension pages), so
// a provider that fails on every mount does not report from scratch again.
// The extension service worker has none and keeps the state in memory.
export function getOneKeyIdAuthFailureLogLimiterStorage():
  | IOneKeyIdAuthFailureLogLimiterStorage
  | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

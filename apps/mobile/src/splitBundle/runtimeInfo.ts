/**
 * Runtime info helpers (Phase 2)
 *
 * Detects current runtime kind (main vs background) from the global flag
 * set in index.ts / background.ts entry points.
 */

import type { RuntimeKind } from './types';

type RuntimeGlobal = typeof globalThis & {
  __ONEKEY_RUNTIME_KIND__?: RuntimeKind;
};

export function getRuntimeKind(): RuntimeKind {
  return (globalThis as RuntimeGlobal).__ONEKEY_RUNTIME_KIND__ || 'main';
}

export function isMainRuntime(): boolean {
  return getRuntimeKind() === 'main';
}

export function isBackgroundRuntime(): boolean {
  return getRuntimeKind() === 'background';
}

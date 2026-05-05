/**
 * Runtime info helpers (Phase 2)
 *
 * Detects current runtime kind (main vs background) from the global flag
 * set in index.ts / background.ts entry points.
 */

import type { IRuntimeKind } from './types';

type IRuntimeGlobal = typeof globalThis & {
  __ONEKEY_RUNTIME_KIND__?: IRuntimeKind;
};

export function getRuntimeKind(): IRuntimeKind {
  return (globalThis as IRuntimeGlobal).__ONEKEY_RUNTIME_KIND__ || 'main';
}

export function isMainRuntime(): boolean {
  return getRuntimeKind() === 'main';
}

export function isBackgroundRuntime(): boolean {
  return getRuntimeKind() === 'background';
}

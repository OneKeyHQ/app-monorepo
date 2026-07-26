import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';

import type { IHomeStoreSectionSourceResult } from './homeStoreTypes';
import type { IHomeSectionSemanticModel } from '../semantic/homeSemanticTypes';

export function normalizeHomeStoreJson(
  value: unknown,
): IHomeRuntimeJsonValue | undefined {
  const active = new WeakSet<object>();
  const visit = (candidate: unknown): IHomeRuntimeJsonValue | undefined => {
    if (
      candidate === null ||
      typeof candidate === 'string' ||
      typeof candidate === 'boolean'
    ) {
      return candidate;
    }
    if (typeof candidate === 'number') {
      return Number.isFinite(candidate) ? candidate : null;
    }
    if (Array.isArray(candidate)) {
      if (active.has(candidate)) {
        return undefined;
      }
      active.add(candidate);
      const result = candidate.map((item) => visit(item) ?? null);
      active.delete(candidate);
      return result;
    }
    if (!candidate || typeof candidate !== 'object') {
      return undefined;
    }
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) {
      return undefined;
    }
    if (active.has(candidate)) {
      return undefined;
    }
    active.add(candidate);
    const result: Record<string, IHomeRuntimeJsonValue> = {};
    Object.entries(candidate).forEach(([key, item]) => {
      const normalized = visit(item);
      if (normalized !== undefined) {
        result[key] = normalized;
      }
    });
    active.delete(candidate);
    return result;
  };
  return visit(value);
}

export function readHomeStoreSectionPayload<T>(
  value: IHomeRuntimeJsonValue | undefined,
): T | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return (value as { payload?: unknown }).payload as T | undefined;
}

export function createHomeStoreSectionSourceResult(
  value: IHomeSectionSemanticModel,
  data?: IHomeRuntimeJsonValue,
): IHomeStoreSectionSourceResult {
  switch (value.kind) {
    case 'hidden':
      return value;
    case 'loading':
      return { kind: 'loading' };
    case 'empty':
      return { kind: 'empty' };
    case 'error':
      return { kind: 'error' };
    case 'ready':
      return {
        kind: 'ready',
        rowIds: value.rowIds,
        freshness: value.freshness,
        refresh: value.refresh,
        ...(data === undefined ? {} : { data }),
      };
    default:
      return value satisfies never;
  }
}

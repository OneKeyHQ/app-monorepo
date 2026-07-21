import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';
import { isHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type { IHomeStoreSectionSourceResult } from './homeStoreTypes';
import type { IHomeSectionSemanticModel } from '../semantic/homeSemanticTypes';

export function normalizeHomeStoreJson(
  value: unknown,
): IHomeRuntimeJsonValue | undefined {
  try {
    const serialized = stringUtils.stableStringify(value);
    if (!serialized) {
      return undefined;
    }
    const parsed: unknown = JSON.parse(serialized);
    return isHomeRuntimeJsonValue(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
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

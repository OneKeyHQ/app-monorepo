import { getBackgroundThreadSharedStore } from '../modules3rdParty/react-native-background-thread/sharedStore';
import platformEnv from '../platformEnv';

import type {
  IHomeTokenRequest,
  IHomeTokenRequestInvalidation,
} from '../../types/token';

export const BACKGROUND_THREAD_MAIN_CAPABILITIES_KEY = 'onekey:bg:main-caps';

type IHomeTokenRequestGlobal = typeof globalThis & {
  $$homeTokenRequestRuntime?: { mainRuntimeId: string; generation: number };
};

export function isNativeHomeTokenRequestEnabled() {
  return !!(platformEnv.isNative && platformEnv.enableNativeBackgroundThread);
}

function getMainRuntimeState() {
  const runtime = globalThis as IHomeTokenRequestGlobal;
  runtime.$$homeTokenRequestRuntime ??= {
    mainRuntimeId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    generation: 0,
  };
  return runtime.$$homeTokenRequestRuntime;
}

export function getHomeTokenMainRuntimeId() {
  return getMainRuntimeState().mainRuntimeId;
}

export function getAdvertisedHomeTokenMainRuntimeId(): string | undefined {
  const value = getBackgroundThreadSharedStore()?.get(
    BACKGROUND_THREAD_MAIN_CAPABILITIES_KEY,
  );
  if (typeof value !== 'string') return undefined;
  try {
    const payload = JSON.parse(value) as { mainRuntimeId?: unknown };
    return typeof payload?.mainRuntimeId === 'string'
      ? payload.mainRuntimeId
      : undefined;
  } catch {
    return undefined;
  }
}

export function createHomeTokenRequestInvalidation():
  | IHomeTokenRequestInvalidation
  | undefined {
  if (!isNativeHomeTokenRequestEnabled()) return undefined;
  const state = getMainRuntimeState();
  state.generation += 1;
  return {
    mainRuntimeId: state.mainRuntimeId,
    generation: state.generation,
  };
}

export function createHomeTokenRequest(
  ownerKey: string,
): IHomeTokenRequest | undefined {
  const invalidation = createHomeTokenRequestInvalidation();
  return invalidation ? { ...invalidation, ownerKey } : undefined;
}

export function isHomeTokenRequestCurrent(request?: IHomeTokenRequest) {
  if (!isNativeHomeTokenRequestEnabled()) return true;
  const state = getMainRuntimeState();
  return (
    !!request &&
    request.mainRuntimeId === state.mainRuntimeId &&
    request.generation === state.generation &&
    !!request.ownerKey
  );
}

export function retireHomeTokenRequest(request?: IHomeTokenRequest) {
  if (
    request &&
    isNativeHomeTokenRequestEnabled() &&
    isHomeTokenRequestCurrent(request)
  ) {
    // Retire locally before the exact-token cancellation reaches bg. Cleanup
    // from an older mount must not invalidate a newer mount's generation.
    getMainRuntimeState().generation += 1;
  }
}

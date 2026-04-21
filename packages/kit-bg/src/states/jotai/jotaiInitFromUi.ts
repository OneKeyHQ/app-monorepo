import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';

import { globalJotaiStorageReadyHandler } from './jotaiStorage';
import { globalAtomRegistry } from './utils';
import { jotaiDefaultStore } from './utils/jotaiDefaultStore';

import type { EAtomNames } from './atomNames';
import type { IJotaiAtomSetWithoutProxy, IJotaiWritableAtomPro } from './types';

function isCrossAtomLike(
  value: unknown,
): value is { atom: () => unknown; name?: string } {
  return !!(
    value &&
    typeof value === 'object' &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    typeof (value as any).atom === 'function'
  );
}

export async function jotaiUpdateFromUiByBgBroadcast(
  params: IGlobalStatesSyncBroadcastParams,
) {
  // Try registry first (no barrel import needed)
  const registeredAtom = globalAtomRegistry.get(params.name);
  if (registeredAtom) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-call
    const atomObj = registeredAtom.atom() as IJotaiWritableAtomPro<
      any,
      any,
      any
    >;
    await jotaiDefaultStore.set(atomObj, params);
    return;
  }
  // Fallback: barrel import for atoms not yet in registry
  const allAtoms = await import('./atoms');
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const atomInfo = allAtoms[params.name] as unknown;
  if (!isCrossAtomLike(atomInfo)) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const atomObj = atomInfo.atom() as IJotaiWritableAtomPro<any, any, any>;
  await jotaiDefaultStore.set(atomObj, params);
}

/**
 * Hydrate main-thread jotai store with cached/RPC states.
 *
 * Fast path (MMKV cache): stores snapshot on globalThis and resolves immediately.
 * Each atom picks up its value from the snapshot when it's first created
 * (in crossAtomBuilder via initialValue override).
 *
 * Slow path (RPC fallback): barrel-imports all atoms and sets values directly.
 */
export async function jotaiInitFromUi({
  states,
  useSnapshotInjection,
}: {
  states: Record<EAtomNames, any>;
  useSnapshotInjection?: boolean;
}) {
  if (useSnapshotInjection) {
    // Store snapshot on globalThis for atoms to read at creation time.
    // Each atom in crossAtomBuilder checks this and uses the cached value
    // as initialValue instead of the hardcoded default.
    (globalThis as any).__ONEKEY_JOTAI_INIT_STATES__ = states;
    globalJotaiStorageReadyHandler.resolveReady(true);
    return;
  }

  // Slow path: barrel import + set each atom (used for RPC fallback / extension UI)
  const allAtoms = await import('./atoms');
  await Promise.all(
    Object.entries(states).map(async ([key, value]) => {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const atomInfo = allAtoms[key] as unknown;
      if (!isCrossAtomLike(atomInfo)) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const atomObj = atomInfo.atom() as IJotaiWritableAtomPro<any, any, any>;
      const data: IJotaiAtomSetWithoutProxy = {
        $$isForceSetAtomWithoutProxy: true,
        name: key,
        payload: value,
      };
      await jotaiDefaultStore.set(atomObj, data);
    }),
  );
  globalJotaiStorageReadyHandler.resolveReady(true);
}

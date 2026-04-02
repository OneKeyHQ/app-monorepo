import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';

import { globalJotaiStorageReadyHandler } from './jotaiStorage';
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
  const allAtoms = await import('./atoms');
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const atomInfo = allAtoms[params.name] as unknown;
  if (!isCrossAtomLike(atomInfo)) {
    // In some builds the UI bundle may not include all atom exports (tree-shaking),
    // or BG may broadcast an atom not available in the UI. Avoid crashing UI.
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const atomObj = atomInfo.atom() as IJotaiWritableAtomPro<any, any, any>;
  await jotaiDefaultStore.set(atomObj, params);
}

export async function jotaiInitFromUi({
  states,
}: {
  states: Record<EAtomNames, any>;
}) {
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

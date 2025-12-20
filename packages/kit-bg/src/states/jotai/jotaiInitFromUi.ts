import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';

import { globalJotaiStorageReadyHandler } from './jotaiStorage';
import { jotaiDefaultStore } from './utils/jotaiDefaultStore';

import type { EAtomNames } from './atomNames';
import type { IJotaiAtomSetWithoutProxy, IJotaiWritableAtomPro } from './types';

export async function jotaiUpdateFromUiByBgBroadcast(
  params: IGlobalStatesSyncBroadcastParams,
) {
  const allAtoms = await import('./atoms');
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const atomInfo = allAtoms[params.name] as JotaiCrossAtom<any>;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const atomObj = atomInfo.atom() as unknown as IJotaiWritableAtomPro<
    any,
    any,
    any
  >;
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
      const atomInfo = allAtoms[key] as JotaiCrossAtom<any>;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const atomObj = atomInfo.atom() as unknown as IJotaiWritableAtomPro<
        any,
        any,
        any
      >;
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

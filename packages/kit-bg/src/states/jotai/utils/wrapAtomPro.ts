import { atom } from 'jotai';

import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { JOTAI_RESET } from '../types';

import type { EAtomNames } from '../atomNames';
import type {
  IJotaiAtomSetWithoutProxy,
  IJotaiSetter,
  IJotaiWritableAtomPro,
} from '../types';

export function wrapAtomPro(
  name: EAtomNames,
  baseAtom: IJotaiWritableAtomPro<
    unknown,
    [update: unknown],
    Promise<void> | undefined
  >,
) {
  const doSet = async ({
    payload,
    proxyToBg,
    set,
  }: {
    payload: any;
    proxyToBg: boolean;
    set: IJotaiSetter;
  }) => {
    if (proxyToBg && platformEnv.isExtensionUi) {
      await global.$jotaiBgSync.proxyStateUpdateActionFromUiToBg({
        name,
        payload,
      });
      return;
    }
    await set(baseAtom, payload);
    if (platformEnv.isExtensionBackground) {
      await global.$jotaiBgSync.broadcastStateUpdateFromBgToUi({
        name,
        payload,
      });
    }
  };
  const proAtom = atom(
    (get) => get(baseAtom),
    async (get, set, update) => {
      let nextValue =
        typeof update === 'function'
          ? (
              update as (
                prev: any | Promise<any>,
              ) => any | Promise<any> | typeof JOTAI_RESET
            )(get(baseAtom))
          : update;

      let proxyToBg = false;
      if (platformEnv.isExtensionUi && name) {
        proxyToBg = true;
        const nextValueFromBg = nextValue as IGlobalStatesSyncBroadcastParams;
        if (
          nextValueFromBg?.$$isFromBgStatesSyncBroadcast &&
          nextValueFromBg?.name === name
        ) {
          nextValue = nextValueFromBg.payload;
          proxyToBg = false;
        }
        const nextValueFromUiInit = nextValue as IJotaiAtomSetWithoutProxy;
        if (
          nextValueFromUiInit?.$$isForceSetAtomWithoutProxy &&
          nextValueFromUiInit.name === name
        ) {
          nextValue = nextValueFromUiInit.payload;
          proxyToBg = false;
        }
      }

      if (nextValue === JOTAI_RESET) {
        await doSet({
          proxyToBg,
          set,
          payload: baseAtom.initialValue,
        });
        return;
      }
      if (nextValue instanceof Promise) {
        return nextValue.then(async (resolvedValue) =>
          doSet({
            proxyToBg,
            set,
            payload: resolvedValue,
          }),
        );
      }

      await doSet({
        proxyToBg,
        set,
        payload: nextValue,
      });
    },
  ) as IJotaiWritableAtomPro<
    unknown,
    [update: unknown],
    Promise<void> | undefined
  >;

  return proAtom;
}

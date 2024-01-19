/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback } from 'react';

import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IAccountSelectorMapValue = {
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
  enabledNum: number[];
  count: number;
};
export type IAccountSelectorMap = {
  // key = sceneId
  [key: string]: IAccountSelectorMapValue;
};
export const {
  target: accountSelectorMapAtom,
  use: useAccountSelectorMapAtom,
} = globalAtom<IAccountSelectorMap>({
  name: EAtomNames.accountSelectorMapAtom,
  initialValue: {},
});

let memoMap: IAccountSelectorMap = {};

export function useAccountSelectorTrackerMap() {
  const [, setMap] = useAccountSelectorMapAtom();

  const setMapFinal = useCallback(
    (mapUpdate: IAccountSelectorMap) => {
      memoMap = mapUpdate;
      setMap(mapUpdate);
    },
    [setMap],
  );
  return { setMap: setMapFinal };
}

export function getAccountSelectorTrackerMap() {
  return memoMap;
}

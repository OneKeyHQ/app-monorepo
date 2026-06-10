import { okRaceLog } from '@onekeyhq/shared/src/utils/debug/okRaceLog'; // OKRACE

import {
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
} from '../../states/jotai/contexts/accountSelector';

export function AccountSelectorStorageReady({ children }: { children?: any }) {
  const [storageReady] = useAccountSelectorStorageReadyAtom();
  const { sceneName } = useAccountSelectorSceneInfo();
  if (sceneName === 'swap' || sceneName === 'perp')
    okRaceLog(`gate scene=${sceneName} storageReady=${storageReady}`); // OKRACE
  if (storageReady) {
    // TODO selectedAccount ready after storage init, but activeAccount not ready yet, may cause an additional refresh.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return children;
  }
  return null;
}

import { useAccountSelectorStorageReadyAtom } from '../../states/jotai/contexts/accountSelector';

export function AccountSelectorStorageReady({ children }: { children?: any }) {
  const [storageReady] = useAccountSelectorStorageReadyAtom();
  if (storageReady) {
    // TODO selectedAccount ready after storage init, but activeAccount not ready yet, may cause an additional refresh.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return children;
  }
  return null;
}

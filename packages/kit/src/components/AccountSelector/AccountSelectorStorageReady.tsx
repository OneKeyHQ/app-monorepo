import { useAccountSelectorStorageReadyAtom } from '../../states/jotai/contexts/accountSelector/atoms';

export function AccountSelectorStorageReady({
  children,
  waitForStorageReady = true,
}: {
  children?: any;
  waitForStorageReady?: boolean;
}) {
  const [storageReady] = useAccountSelectorStorageReadyAtom();
  if (!waitForStorageReady || storageReady) {
    // TODO selectedAccount ready after storage init, but activeAccount not ready yet, may cause an additional refresh.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return children;
  }
  return null;
}

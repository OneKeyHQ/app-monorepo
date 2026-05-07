import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function useAllWalletsAreBtcOnly(): boolean {
  const fetcher = useCallback(async () => {
    const { wallets } =
      await backgroundApiProxy.serviceAccount.getAllHdHwQrWallets();
    const usableWallets = wallets.filter(
      (w) => !accountUtils.isWalletDeprecatedOrMocked(w),
    );
    if (usableWallets.length === 0) {
      return false;
    }
    const checks = await Promise.all(
      usableWallets.map((w) =>
        backgroundApiProxy.serviceAccount.isBtcOnlyFirmwareByWalletId({
          walletId: w.id,
        }),
      ),
    );
    return checks.every(Boolean);
  }, []);

  const { result } = usePromiseResult(fetcher, [fetcher]);
  return result === true;
}

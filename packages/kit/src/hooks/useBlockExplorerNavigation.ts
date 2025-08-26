import { useMemo } from 'react';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

export const useBlockExplorerNavigation = (
  network: IServerNetwork | undefined,
  walletId: string | undefined,
) => {
  const isInternalNav = useMemo(
    () =>
      network?.isAllNetworks &&
      !accountUtils.isOthersWallet({ walletId: walletId ?? '' }),
    [network?.isAllNetworks, walletId],
  );

  return { isInternalNav };
};

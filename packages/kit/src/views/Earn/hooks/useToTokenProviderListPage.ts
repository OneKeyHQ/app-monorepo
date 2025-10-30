import { useCallback } from 'react';

import type { IEarnAvailableAssetProtocol } from '@onekeyhq/shared/types/earn';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EarnNavigation } from '../earnUtils';

export function useToTokenProviderListPage() {
  const navigation = useAppNavigation();

  return useCallback(
    async (params: {
      networkId: string;
      accountId: string;
      indexedAccountId?: string;
      symbol: string;
      protocols: IEarnAvailableAssetProtocol[];
      logoURI?: string;
    }) => {
      await EarnNavigation.toTokenProviderListPage(navigation, params);
    },
    [navigation],
  );
}

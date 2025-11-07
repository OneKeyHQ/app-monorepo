import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  IEarnWalletHistoryItem,
  IEarnWalletHistoryNetwork,
} from '@onekeyhq/shared/src/referralCode/type';
import { ETabReferFriendsRoutes } from '@onekeyhq/shared/src/routes';

export function useNavigateToWalletAddresses() {
  const navigation = useAppNavigation();

  return useCallback(
    (params: {
      items: IEarnWalletHistoryItem[];
      networks: IEarnWalletHistoryNetwork[];
    }) => {
      navigation.push(
        ETabReferFriendsRoutes.TabYourReferredWalletAddresses,
        params,
      );
    },
    [navigation],
  );
}

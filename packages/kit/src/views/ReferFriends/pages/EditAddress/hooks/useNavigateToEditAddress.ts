import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IModalReferFriendsParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToEditAddress() {
  const navigation = useAppNavigation();

  return useCallback(
    (
      params: IModalReferFriendsParamList[EModalReferFriendsRoutes.EditAddress],
    ) => {
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.EditAddress,
        params,
      });
    },
    [navigation],
  );
}

import { useCallback } from 'react';

import { useIsModalPage } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IModalReferFriendsParamList } from '@onekeyhq/shared/src/routes';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

export function useNavigateToEditAddress() {
  const navigation = useAppNavigation();
  const isModalPage = useIsModalPage();

  return useCallback(
    (
      params: IModalReferFriendsParamList[EModalReferFriendsRoutes.EditAddress],
    ) => {
      // Inside the referral modal, push onto its stack (back button, push
      // transition) instead of opening a second modal exactly on top of it.
      if (isModalPage) {
        navigation.push(EModalReferFriendsRoutes.EditAddress, params);
        return;
      }
      navigation.pushModal(EModalRoutes.ReferFriendsModal, {
        screen: EModalReferFriendsRoutes.EditAddress,
        params,
      });
    },
    [isModalPage, navigation],
  );
}

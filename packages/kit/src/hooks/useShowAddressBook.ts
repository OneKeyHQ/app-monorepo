import { useCallback } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalAddressBookRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from './useAppNavigation';

export function useShowAddressBook({
  useNewModal = false,
}: {
  useNewModal?: boolean;
}) {
  const navigation = useAppNavigation();

  const onPress = useCallback(
    async (nav?: ReturnType<typeof useAppNavigation>) => {
      const appNavigation = nav || navigation;
      if (useNewModal) {
        appNavigation.pushModal(EModalRoutes.AddressBookModal, {
          screen: EModalAddressBookRoutes.ListItemModal,
          params: {},
        });
      } else {
        appNavigation.push(EModalAddressBookRoutes.ListItemModal);
      }
      defaultLogger.setting.page.enterAddressBook();
    },
    [navigation, useNewModal],
  );

  return onPress;
}

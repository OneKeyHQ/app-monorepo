import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useAddressBookPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalAddressBookRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { showAddressSafeNotificationDialog } from '../components/AddressInput/AddressSafeDialog';

import useAppNavigation from './useAppNavigation';

export function useShowAddressBook({
  useNewModal = false,
}: {
  useNewModal?: boolean;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [{ hideDialogInfo }] = useAddressBookPersistAtom();

  const showAddressBook = useCallback(async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    if (useNewModal) {
      navigation.pushModal(EModalRoutes.AddressBookModal, {
        screen: EModalAddressBookRoutes.ListItemModal,
        params: {},
      });
    } else {
      navigation.push(EModalAddressBookRoutes.ListItemModal);
    }
    defaultLogger.setting.page.enterAddressBook();
  }, [navigation, useNewModal]);

  const onPress = useCallback(async () => {
    if (!hideDialogInfo) {
      await showAddressSafeNotificationDialog({
        intl,
      });
      await backgroundApiProxy.serviceAddressBook.hideDialogInfo();
    }
    await showAddressBook();
  }, [hideDialogInfo, showAddressBook, intl]);

  return onPress;
}

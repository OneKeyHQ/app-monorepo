import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EModalAddressBookRoutes } from '@onekeyhq/kit/src/common/components/AddressBook/router/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useAddressBookPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/addressBooks';

import type { IAddressItem } from '../type';

export const useAddressBookItems = () => {
  const [encode] = useAddressBookPersistAtom();
  return usePromiseResult<IAddressItem[]>(
    async () => {
      const items =
        await backgroundApiProxy.serviceAddressBook.getAddressBookItems();
      return items;
    },
    // eslint-disable-next-line
    [encode],
    { watchLoading: true },
  );
};

export const useAddressBookPick = () => {
  const [passwordSetting] = usePasswordPersistAtom();
  const navigation = useAppNavigation();
  return useCallback(async () => {
    const password =
      await backgroundApiProxy.servicePassword.getCachedPassword();
    if (!passwordSetting.isPasswordSet || !password) {
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
    }
    navigation.pushModal(EModalRoutes.AddressBookModal, {
      screen: EModalAddressBookRoutes.PickItemModal,
    });
  }, [navigation, passwordSetting]);
};

export const useAddressBookList = () => {
  const [passwordSetting] = usePasswordPersistAtom();
  const navigation = useAppNavigation();
  return useCallback(async () => {
    const password =
      await backgroundApiProxy.servicePassword.getCachedPassword();
    if (!passwordSetting.isPasswordSet || !password) {
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
    }
    navigation.pushModal(EModalRoutes.AddressBookModal, {
      screen: EModalAddressBookRoutes.ListItemModal,
    });
  }, [navigation, passwordSetting]);
};

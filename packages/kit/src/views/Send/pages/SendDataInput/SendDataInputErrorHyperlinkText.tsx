import { useCallback } from 'react';

import type { IErrorMessageComponentType } from '@onekeyhq/components';
import { useFormContext } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes/addressBook';

export function SendDataInputErrorHyperlinkText(
  props: IErrorMessageComponentType,
) {
  const form = useFormContext();
  const navigation = useAppNavigation();

  const onLinkPress = useCallback(async () => {
    const values = form.getValues();
    const { to, accountId, networkId } = values;
    const address = typeof to === 'string' ? to : (to as { raw: string }).raw;
    if (!address) {
      return;
    }
    const { addressBookId, addressBookName, isAllowListed } =
      await backgroundApiProxy.serviceAccountProfile.queryAddress({
        accountId,
        networkId,
        address,
        enableAddressBook: true,
        enableWalletName: true,
        skipValidateAddress: true,
      });

    if (!isAllowListed) {
      navigation.pushModal(EModalRoutes.AddressBookModal, {
        screen: addressBookId
          ? EModalAddressBookRoutes.EditItemModal
          : EModalAddressBookRoutes.AddItemModal,
        params: {
          id: addressBookId,
          networkId,
          address,
          name: addressBookName,
          onConfirm: () => {
            appEventBus.emit(
              EAppEventBusNames.TriggerAddressInputValidate,
              undefined,
            );
          },
        },
      });
    }
  }, [form, navigation]);
  return (
    <HyperlinkText
      {...props}
      autoHandleResult={false}
      values={{
        contactId: '#',
        contactAddress: '#',
      }}
      onLinkPress={onLinkPress}
    />
  );
}

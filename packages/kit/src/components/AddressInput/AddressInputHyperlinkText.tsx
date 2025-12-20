import { useCallback, useContext } from 'react';

import type { IFieldErrorProps } from '@onekeyhq/components';
import { useFormContext } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes/addressBook';

import { AddressInputContext } from './AddressInputContext';

export function AddressInputHyperlinkText({
  error,
  errorMessageAlign,
  testID,
}: IFieldErrorProps) {
  const form = useFormContext();
  const navigation = useAppNavigation();
  const contentValues = useContext(AddressInputContext);
  const onAction = useCallback(
    async (actionId: string) => {
      if (
        actionId === 'to_edit_address_book_page' ||
        actionId === 'to_add_address_page'
      ) {
        const values = form.getValues() || {};
        const to = contentValues.name ? values[contentValues.name] : '';
        const accountId = values.accountId || contentValues.accountId;
        const networkId = values.networkId || contentValues.networkId;
        const address =
          typeof to === 'string' ? to : (to as { raw: string }).raw;
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
            screen: EModalAddressBookRoutes.EditItemModal,
            params: {
              id: addressBookId,
              address: address ?? '',
              networkId,
              isAllowListed: true,
            },
          });
        }
      }
    },
    [
      contentValues.accountId,
      contentValues.name,
      contentValues.networkId,
      form,
      navigation,
    ],
  );
  return (
    <HyperlinkText
      color="$textCritical"
      size="$bodyMd"
      textAlign={errorMessageAlign}
      key={error?.message}
      testID={testID ? `${testID}-message` : undefined}
      translationId={error?.message as ETranslations}
      defaultMessage={error?.message as ETranslations}
      autoHandleResult={false}
      onAction={onAction}
    />
  );
}

export const renderAddressInputHyperlinkText = (props: IFieldErrorProps) => (
  <AddressInputHyperlinkText {...props} />
);

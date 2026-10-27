import { useCallback, useContext } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import type { IFieldErrorProps } from '@onekeyhq/components';
import { useFormContext } from '@onekeyhq/components/src/hooks/useForm';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes/addressBook';

import { AddressInputContext } from './AddressInputContext';
import {
  getAddressQueryResolvedAddress,
  looksLikeAnotherAddress,
} from './utils';

import type { IAddressInputValue } from '.';

export function AddressInputHyperlinkText({
  error,
  errorMessageAlign,
  testID,
}: IFieldErrorProps) {
  const intl = useIntl();
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
        const toValue: IAddressInputValue =
          typeof to === 'string' ? { raw: to } : (to as IAddressInputValue);
        const address = toValue.raw;
        if (!address) {
          return;
        }
        const queryResult =
          await backgroundApiProxy.serviceAccountProfile.queryAddress({
            accountId,
            networkId,
            address,
            enableAddressBook: true,
            enableWalletName: true,
            enableNameResolve: true,
            skipValidateAddress: true,
          });
        const { addressBookId, isAllowListed } = queryResult;

        if (!isAllowListed) {
          // The add button's rule, checked on the same resolved address: the
          // form value only carries one for a valid address, which this
          // error is not.
          if (
            !addressBookId &&
            looksLikeAnotherAddress({
              similarAddress: toValue.similarAddress,
              address: getAddressQueryResolvedAddress(queryResult),
              isLookalikeAddress: contentValues.isLookalikeAddress,
            })
          ) {
            Toast.warning({
              title: intl.formatMessage({
                id: ETranslations.wallet_address_poisoning_alert,
              }),
            });
            return;
          }
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
      contentValues.isLookalikeAddress,
      contentValues.name,
      contentValues.networkId,
      form,
      intl,
      navigation,
    ],
  );
  // Filter out "undefined" string which can occur from edge cases
  const messageId =
    error?.message && error.message !== 'undefined'
      ? (error.message as ETranslations)
      : ETranslations.send_address_invalid;

  return (
    <HyperlinkText
      color="$textCritical"
      size="$bodyMd"
      textAlign={errorMessageAlign}
      key={messageId}
      testID={testID ? `${testID}-message` : undefined}
      translationId={messageId}
      defaultMessage={messageId}
      autoExecuteParsedAction={false}
      onAction={onAction}
    />
  );
}

export const renderAddressInputHyperlinkText = (props: IFieldErrorProps) => (
  <AddressInputHyperlinkText {...props} />
);

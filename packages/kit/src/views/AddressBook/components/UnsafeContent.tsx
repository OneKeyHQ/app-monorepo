import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Dialog,
  Page,
  SizableText,
  Stack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export const UnsafeContent = () => {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const onConfirm = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.global_confirm }),
      icon: 'PlaceholderOutline',
      description: ETranslations.address_book_confirm_message,
      tone: 'destructive',
      showConfirmButton: true,
      showCancelButton: true,
      onConfirm: async (inst) => {
        const text =
          await backgroundApiProxy.serviceAddressBook.stringifyItems();
        await backgroundApiProxy.serviceAddressBook.resetItems();
        copyText(
          text,
          ETranslations.address_book_add_address_toast_reset_success,
        );
        await inst.close();
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.address_book_button_reset,
      }),
      onCancelText: intl.formatMessage({
        id: ETranslations.address_book_button_copy,
      }),
      cancelButtonProps: {
        icon: 'Copy2Outline',
      },
      onCancel: async (close) => {
        const text =
          await backgroundApiProxy.serviceAddressBook.stringifyItems();
        copyText(text);
        await close();
      },
    });
  }, [copyText, intl]);
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.address_book_title })}
      />
      <Page.Body>
        <Stack p="$4">
          <Alert
            type="critical"
            title={intl.formatMessage({
              id: ETranslations.address_book_data_anomaly,
            })}
            icon="ErrorOutline"
          />
          <SizableText size="$headingMd" py="$5">
            {intl.formatMessage({
              id: ETranslations.address_book_data_anomaly_description,
            })}
          </SizableText>
          <Stack mt="$5">
            <SizableText size="$headingSm">
              {intl.formatMessage({
                id: ETranslations.address_book_data_anomaly_why_risk,
              })}
            </SizableText>
            <SizableText size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.address_book_data_anomaly_why_risk_description,
              })}
            </SizableText>
          </Stack>
          <Stack mt="$5">
            <SizableText size="$headingSm">
              {intl.formatMessage({
                id: ETranslations.address_book_data_anomaly_why_reset,
              })}
            </SizableText>
            <SizableText size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.address_book_data_anomaly_why_reset_description,
              })}
            </SizableText>
          </Stack>
        </Stack>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.address_book_button_reset,
        })}
        onCancelText={intl.formatMessage({
          id: ETranslations.address_book_button_close,
        })}
        onConfirm={onConfirm}
        onCancel={(close) => close()}
      />
    </Page>
  );
};

import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Dialog,
  Page,
  SizableText,
  Stack,
  Toast,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

export const UnsafeContent = () => {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const copy = useCallback(async () => {
    const text = await backgroundApiProxy.serviceAddressBook.stringifyItems();
    copyText(text);
  }, [copyText]);
  const onConfirm = useCallback(() => {
    Dialog.show({
      title: 'Confirm',
      icon: 'PlaceholderOutline',
      description:
        'Confirming this operation will reset your address book data. To avoid losing your data entirely, you can copy the data to the clipboard and save it.',
      tone: 'destructive',
      showConfirmButton: true,
      showCancelButton: true,
      onConfirm: async (inst) => {
        await copy();
        await backgroundApiProxy.serviceAddressBook.resetItems();
        Toast.success({ title: intl.formatMessage({ id: 'msg__success' }) });
        await inst.close();
      },
      onConfirmText: 'Reset',
      onCancelText: 'Copy',
      cancelButtonProps: {
        icon: 'Copy2Outline',
      },
      onCancel: async (close) => {
        await copy();
        Toast.success({ title: intl.formatMessage({ id: 'msg__success' }) });
        await close();
      },
    });
  }, [copy, intl]);
  return (
    <Page>
      <Page.Header title={intl.formatMessage({ id: 'title__address_book' })} />
      <Page.Body>
        <Stack p="$4">
          <Alert type="critical" title="Data anomaly" icon="ErrorOutline" />
          <SizableText size="$headingMd" py="$5">
            Your contact data may have undergone abnormal changes. To ensure the
            security of your assets, we strongly recommend resetting your
            address book.
          </SizableText>
          <Stack mt="$5">
            <SizableText size="$headingSm">Why is my data at risk?</SizableText>
            <SizableText size="$bodyMd">
              Your data is different from the last confirmation save. Onekey
              ensures the security of your data through cryptographic hashing
              algorithms.
            </SizableText>
          </Stack>
          <Stack mt="$5">
            <SizableText size="$headingSm">
              Why do I need to reset my address book?
            </SizableText>
            <SizableText size="$bodyMd">
              Resetting the data will result in the loss of your current contact
              information. However, it will fully ensure the security of your
              assets.
            </SizableText>
          </Stack>
        </Stack>
      </Page.Body>
      <Page.Footer
        onConfirmText="Reset"
        onCancelText="Close"
        onConfirm={onConfirm}
        onCancel={(close) => close()}
      />
    </Page>
  );
};

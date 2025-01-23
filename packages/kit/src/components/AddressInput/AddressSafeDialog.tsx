import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { TransferAllowListContent } from './AddressSecurityHeaderRightButton';

import type { IntlShape } from 'react-intl';

function Content({ intl }: { intl: IntlShape }) {
  const dialogInstance = useDialogInstance();
  return (
    <YStack gap="$6">
      <XStack gap="$2">
        <XStack>
          <Icon name="FileLockOutline" size="$6" />
        </XStack>
        <YStack gap="$3" flexShrink={1}>
          <SizableText size="$headingMd">
            {intl.formatMessage({
              id: ETranslations.address_book_encrypted_storage_title,
            })}
          </SizableText>
          <YStack flexShrink={1}>
            <SizableText color="$textSubdued" size="$bodyMd" flexShrink={1}>
              {intl.formatMessage({
                id: ETranslations.address_book_encrypted_storage_description,
              })}
            </SizableText>
          </YStack>
        </YStack>
      </XStack>
      <XStack gap="$2">
        <XStack>
          <Icon name="ShieldCheckDoneOutline" size="$6" />
        </XStack>
        <YStack gap="$3" flexShrink={1}>
          <SizableText size="$headingMd">
            {intl.formatMessage({
              id: ETranslations.settings_protection_allowlist_title,
            })}
          </SizableText>
          <TransferAllowListContent onAction={() => dialogInstance.close()} />
        </YStack>
      </XStack>
    </YStack>
  );
}

export const showAddressSafeNotificationDialog = async ({
  intl,
}: {
  intl: IntlShape;
}) =>
  new Promise((resolve) => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.address_book_title,
      }),
      icon: 'ShieldKeyholeOutline',
      description: intl.formatMessage({
        id: ETranslations.address_book_dialog_subtitle,
      }),
      tone: 'default',
      showConfirmButton: true,
      showCancelButton: false,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_ok,
      }),
      onConfirm: async (inst) => {
        await inst.close();
        resolve(undefined);
      },
      confirmButtonProps: {
        testID: 'encrypted-storage-confirm',
      },
      renderContent: <Content intl={intl} />,
    });
  });

import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function useDialogPassphraseEnable() {
  const intl = useIntl();

  const show = useCallback(
    ({
      needEnterPassphrase,
      onConfirmOpenPassphrase,
      onCancelOpenPassphrase,
    }: {
      needEnterPassphrase: boolean;
      onConfirmOpenPassphrase: () => Promise<void>;
      onCancelOpenPassphrase: () => Promise<void>;
    }) => {
      Dialog.show({
        title: intl.formatMessage({
          id: needEnterPassphrase
            ? ETranslations.global_enable_passphrase
            : ETranslations.global_disable_passphrase,
        }),
        renderContent: (
          <SizableText size="$bodyLg" color="$text">
            {intl.formatMessage({
              id: needEnterPassphrase
                ? ETranslations.global_enable_passphrase_detail
                : ETranslations.global_disable_passphrase_detail,
            })}
          </SizableText>
        ),
        onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
        onConfirmText: intl.formatMessage({ id: ETranslations.global_confirm }),
        confirmButtonProps: { variant: 'primary' },
        cancelButtonProps: { variant: 'secondary' },
        onConfirm: async ({ close }) => {
          await onConfirmOpenPassphrase?.();
          void close({ flag: 'confirm' });
        },
        onClose: (extra?: { flag?: string }) => {
          const flag = extra?.flag;
          if (flag === 'confirm' || flag === 'cancel') {
            return;
          }
          void onCancelOpenPassphrase?.();
        },
        onCancel: async (close) => {
          await onCancelOpenPassphrase?.();
          void close();
        },
      });
    },
    [intl],
  );

  return { show };
}

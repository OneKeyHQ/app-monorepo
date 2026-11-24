import type { IDialogShowProps } from '@onekeyhq/components';
import { Dialog, Toast } from '@onekeyhq/components';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

const guidance = {
  wallet: {
    message: ETranslationsMock.wallet_lse_import_again__desc,
    chinese: '请重新导入你的钱包。',
  },
  retry: {
    message: ETranslationsMock.lse_retry__desc,
    chinese: '请重试刚才的操作。',
  },
  restore: {
    message: ETranslationsMock.lse_retry_restore__desc,
    chinese: '请重试恢复此备份。',
  },
} as const;

function formatRecoveryMessage(
  intl: IntlShape,
  id: ETranslationsMock,
  chinese: string,
) {
  const fallback = intl.locale?.startsWith('zh') ? chinese : id;
  if (!intl.messages?.[id]) return fallback;
  return intl.formatMessage({
    id,
    defaultMessage: fallback,
  });
}

export function getLocalSecretEnvelopeRecoveryTitle(intl: IntlShape) {
  return formatRecoveryMessage(
    intl,
    ETranslationsMock.lse_unavailable__title,
    '无法访问本地加密数据',
  );
}

function getRecoveryActionText(
  intl: IntlShape,
  context: keyof typeof guidance,
) {
  switch (context) {
    case 'wallet':
      return formatRecoveryMessage(
        intl,
        ETranslationsMock.wallet_lse_import_again__action,
        '重新导入钱包',
      );
    case 'restore':
      return formatRecoveryMessage(
        intl,
        ETranslationsMock.lse_retry_restore__action,
        '重试恢复',
      );
    case 'retry':
      return intl.formatMessage({ id: ETranslations.global_retry });
    default:
      return intl.formatMessage({ id: ETranslations.global_close });
  }
}

export function showLocalSecretEnvelopeRecoveryDialog({
  intl,
  context,
  onAction,
  options,
}: {
  intl: IntlShape;
  context: keyof typeof guidance;
  onAction?: () => void | Promise<void>;
  options?: Pick<
    IDialogShowProps,
    'confirmButtonProps' | 'onClose' | 'portalContainer'
  >;
}) {
  const { message, chinese } = guidance[context];
  const reason = formatRecoveryMessage(
    intl,
    ETranslationsMock.lse_unavailable__reason,
    '迁移到新设备、转移数据或重装应用后，可能会出现此问题。',
  );
  const close = intl.formatMessage({ id: ETranslations.global_close });

  Dialog.show({
    ...options,
    icon: 'ErrorOutline',
    title: getLocalSecretEnvelopeRecoveryTitle(intl),
    description: `${reason}\n\n${formatRecoveryMessage(intl, message, chinese)}`,
    showCancelButton: Boolean(onAction),
    onCancelText: close,
    onConfirmText: onAction ? getRecoveryActionText(intl, context) : close,
    onConfirm: async (dialog) => {
      await dialog.close();
      await onAction?.();
    },
  });
}

export function showLocalSecretEnvelopeDetailsToast({
  intl,
  onDetails,
  toastId,
}: {
  intl: IntlShape;
  onDetails: () => void;
  toastId: string;
}) {
  Toast.error({
    title: getLocalSecretEnvelopeRecoveryTitle(intl),
    toastId,
    actions: {
      label: intl.formatMessage({ id: ETranslations.global_details }),
      testID: 'lse-recovery-toast-details',
      onPress: () => {
        Toast.dismiss(toastId);
        onDetails();
      },
    },
  });
}

import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  getCexDepositUnsupportedDialogCopy,
  isCexDepositExplicitlyDisabled,
} from '@onekeyhq/shared/src/utils/cexDepositSupportUtils';
import type {
  IAddressBadge,
  ICexSupportedInfo,
} from '@onekeyhq/shared/types/address';

import type { IntlShape } from 'react-intl';

function showCexDepositUnsupportedDialog({
  title,
  description,
  intl,
}: {
  title?: string;
  description?: string;
  intl: IntlShape;
}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (confirmed: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(confirmed);
    };

    Dialog.show({
      icon: 'ShieldOutline',
      tone: 'warning',
      title:
        title ||
        intl.formatMessage({
          id: ETranslations.global_warning,
        }),
      description,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_continue,
      }),
      onCancelText: intl.formatMessage({
        id: ETranslations.global_cancel,
      }),
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      onClose: () => settle(false),
      confirmButtonProps: {
        testID: 'cex-deposit-unsupported-confirm-btn',
      },
      cancelButtonProps: {
        testID: 'cex-deposit-unsupported-cancel-btn',
      },
    });
  });
}

export async function confirmCexDepositIfUnsupported({
  intl,
  cexSupportedInfo,
  badges,
  addressLabel,
}: {
  intl: IntlShape;
  cexSupportedInfo?: ICexSupportedInfo;
  badges?: IAddressBadge[];
  addressLabel?: string;
}): Promise<boolean> {
  if (!isCexDepositExplicitlyDisabled(cexSupportedInfo?.depositEnable)) {
    return true;
  }

  const copy = getCexDepositUnsupportedDialogCopy({
    badges,
    cexLabel: cexSupportedInfo?.cexLabel,
    addressLabel,
  });

  return showCexDepositUnsupportedDialog({
    title: copy.title,
    description: copy.description,
    intl,
  });
}

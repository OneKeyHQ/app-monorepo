import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { isCexDepositExplicitlyDisabled } from '@onekeyhq/shared/src/utils/cexDepositSupportUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ICexSupportedInfo } from '@onekeyhq/shared/types/address';

import type { IntlShape } from 'react-intl';

function showCexDepositUnsupportedDialog(intl: IntlShape): Promise<boolean> {
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
      title: intl.formatMessage({
        id: ETranslations.cex_deposit_may_not_be_supported__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.cex_deposit_may_not_be_supported__desc,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_continue,
      }),
      onCancelText: intl.formatMessage({
        id: ETranslations.global_back,
      }),
      onConfirm: async ({ close }) => {
        await close?.({ flag: 'confirm' });
      },
      onCancel: (close) => {
        void close();
      },
      onClose: (extra) => {
        settle(extra?.flag === 'confirm');
      },
      confirmButtonProps: {
        testID: 'cex-deposit-unsupported-confirm-btn',
        variant: 'secondary',
      },
      cancelButtonProps: {
        testID: 'cex-deposit-unsupported-cancel-btn',
        variant: 'primary',
      },
      footerProps: {
        flexDirection: 'row-reverse',
        $md: {
          flexDirection: 'column',
        },
      },
    });
  });
}

export async function confirmCexDepositIfUnsupported({
  intl,
  isNFT,
  networkId,
  cexSupportedInfo,
  hasAcknowledgedWarning,
}: {
  intl: IntlShape;
  isNFT?: boolean;
  networkId: string;
  cexSupportedInfo?: ICexSupportedInfo;
  hasAcknowledgedWarning?: boolean;
}): Promise<{ canProceed: boolean; hasAcknowledgedWarning: boolean }> {
  if (hasAcknowledgedWarning) {
    return { canProceed: true, hasAcknowledgedWarning: true };
  }
  if (isNFT || networkUtils.isLightningNetworkByNetworkId(networkId)) {
    return { canProceed: true, hasAcknowledgedWarning: false };
  }
  if (!isCexDepositExplicitlyDisabled(cexSupportedInfo?.depositEnable)) {
    return { canProceed: true, hasAcknowledgedWarning: false };
  }

  const confirmed = await showCexDepositUnsupportedDialog(intl);
  return { canProceed: confirmed, hasAcknowledgedWarning: confirmed };
}

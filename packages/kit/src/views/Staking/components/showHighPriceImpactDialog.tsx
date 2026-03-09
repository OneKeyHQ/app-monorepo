import BigNumber from 'bignumber.js';

import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IStakeTransactionConfirmation } from '@onekeyhq/shared/types/staking';

import type { IManagePageV2ReceiveInputConfig } from './ManagePageV2ReceiveInput';
import type { IntlShape } from 'react-intl';

// Price impact threshold: show dialog when user receives >1% less than they pay
const HIGH_PRICE_IMPACT_THRESHOLD = -1;

export function calcPriceImpactInfo({
  payFiatValue,
  receiveConfig,
  receiveDescription,
}: {
  payFiatValue?: string;
  receiveConfig?: IManagePageV2ReceiveInputConfig;
  receiveDescription?: IStakeTransactionConfirmation['receive'];
}): { percent: string; lossAmount: string } | undefined {
  if (!payFiatValue || !receiveConfig?.price || !receiveConfig?.enabled) {
    return undefined;
  }

  const payBN = new BigNumber(payFiatValue);
  const receiveAmount = earnUtils.extractAmountFromText(
    receiveDescription?.description,
  );
  const receiveBN = new BigNumber(receiveAmount).multipliedBy(
    receiveConfig.price,
  );

  if (payBN.isNaN() || receiveBN.isNaN() || payBN.lte(0) || receiveBN.lte(0)) {
    return undefined;
  }

  // (receive - pay) / pay * 100
  const impactPercent = receiveBN
    .minus(payBN)
    .dividedBy(payBN)
    .multipliedBy(100);

  if (impactPercent.isNaN() || impactPercent.gte(HIGH_PRICE_IMPACT_THRESHOLD)) {
    return undefined;
  }

  return {
    percent: impactPercent.abs().toFixed(2),
    lossAmount: payBN.minus(receiveBN).toFixed(2),
  };
}

export function showHighPriceImpactDialog(
  intl: IntlShape,
  params: { percent: string; lossAmount: string },
): Promise<boolean> {
  return new Promise((resolve) => {
    let confirmed = false;
    Dialog.show({
      icon: 'InfoCircleOutline',
      title: intl.formatMessage({
        id: ETranslations.defi_pendle_double_check_title,
      }),
      description: intl.formatMessage(
        { id: ETranslations.defi_pendle_double_check_body },
        { percent: params.percent, lossAmount: params.lossAmount },
      ),
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_confirm,
      }),
      onCancelText: intl.formatMessage({
        id: ETranslations.global_cancel,
      }),
      onConfirm: () => {
        confirmed = true;
      },
      onClose: () => resolve(confirmed),
    });
  });
}

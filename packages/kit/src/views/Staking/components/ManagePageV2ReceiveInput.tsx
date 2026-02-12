import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IStakeTransactionConfirmation } from '@onekeyhq/shared/types/staking';

import { StakingAmountInput } from './StakingAmountInput';

export type IManagePageV2ReceiveInputConfig = {
  enabled?: boolean;
  title?: string;
  tokenImageUri?: string;
  tokenSymbol?: string;
  tokenAddress?: string;
  networkImageUri?: string;
  balance?: string;
  price?: string;
};

export function ManagePageV2ReceiveInput({
  receive,
  config,
  fiatSymbol,
}: {
  receive?: IStakeTransactionConfirmation['receive'];
  config?: IManagePageV2ReceiveInputConfig;
  fiatSymbol?: string;
}) {
  const intl = useIntl();

  const enabled = !!config?.enabled;
  const receiveAmount = useMemo(
    () => earnUtils.extractAmountFromText(receive?.description),
    [receive?.description],
  );

  const receiveFiatValue = useMemo(() => {
    const amountBN = new BigNumber(receiveAmount || '0');
    const priceBN = new BigNumber(config?.price || '0');
    if (
      amountBN.isNaN() ||
      priceBN.isNaN() ||
      amountBN.lte(0) ||
      priceBN.lte(0)
    ) {
      return '0';
    }
    return amountBN.multipliedBy(priceBN).toFixed();
  }, [receiveAmount, config?.price]);

  if (!enabled) {
    return null;
  }

  return (
    <StakingAmountInput
      title={
        config?.title ||
        receive?.title?.text ||
        intl.formatMessage({
          id: ETranslations.swap_review_you_receive,
        })
      }
      disabled
      value={receiveAmount}
      onChange={() => {}}
      onBlur={() => {}}
      tokenSelectorTriggerProps={{
        selectedTokenImageUri: config?.tokenImageUri,
        selectedTokenSymbol: config?.tokenSymbol,
        selectedNetworkImageUri: config?.networkImageUri,
        disabled: true,
      }}
      inputProps={{
        placeholder: '0',
      }}
      balanceProps={
        config?.balance
          ? {
              value: config.balance,
            }
          : undefined
      }
      valueProps={{
        value: receiveFiatValue,
        currency: receiveFiatValue !== '0' ? fiatSymbol : undefined,
      }}
      onSelectPercentageStage={() => {}}
    />
  );
}

import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import type { IAmountInputFormItemProps } from '@onekeyhq/kit/src/components/AmountInput';
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
  tokenSelectorTriggerProps?: Partial<
    NonNullable<IAmountInputFormItemProps['tokenSelectorTriggerProps']>
  >;
};

export function ManagePageV2ReceiveInput({
  receive,
  config,
  fiatSymbol,
  payFiatValue,
  loading,
}: {
  receive?: IStakeTransactionConfirmation['receive'];
  config?: IManagePageV2ReceiveInputConfig;
  fiatSymbol?: string;
  payFiatValue?: string;
  loading?: boolean;
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

  const priceImpactComponent = useMemo(() => {
    if (!payFiatValue || !receiveFiatValue) {
      return undefined;
    }
    const payBN = new BigNumber(payFiatValue);
    const receiveBN = new BigNumber(receiveFiatValue);
    if (
      payBN.isNaN() ||
      receiveBN.isNaN() ||
      payBN.lte(0) ||
      receiveBN.lte(0)
    ) {
      return undefined;
    }
    const diff = receiveBN.minus(payBN).dividedBy(payBN).multipliedBy(100);
    if (diff.isNaN() || diff.isZero()) {
      return undefined;
    }
    const sign = diff.gt(0) ? '+' : '';
    const formatted = `(${sign}${diff.toFixed(2)}%)`;
    return (
      <SizableText size="$bodySm" color="$textSubdued">
        {formatted}
      </SizableText>
    );
  }, [payFiatValue, receiveFiatValue]);

  const receiveTokenSelectorTriggerProps = useMemo(
    () => ({
      selectedTokenImageUri: config?.tokenImageUri,
      selectedTokenSymbol: config?.tokenSymbol,
      selectedNetworkImageUri: config?.networkImageUri,
      disabled: true,
      ...config?.tokenSelectorTriggerProps,
    }),
    [
      config?.networkImageUri,
      config?.tokenImageUri,
      config?.tokenSelectorTriggerProps,
      config?.tokenSymbol,
    ],
  );

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
      forceSubduedBackground
      value={receiveAmount}
      onChange={() => {}}
      onBlur={() => {}}
      tokenSelectorTriggerProps={receiveTokenSelectorTriggerProps}
      inputProps={{
        placeholder: '0',
        loading,
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
        moreComponent: priceImpactComponent,
        loading,
      }}
      onSelectPercentageStage={() => {}}
    />
  );
}

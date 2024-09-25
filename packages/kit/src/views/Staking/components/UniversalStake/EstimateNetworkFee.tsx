import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Dialog,
  NumberSizeableText,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnEstimateAction } from '@onekeyhq/shared/types/staking';

import { CalculationListItem } from '../CalculationList';

const EstimateNetworkFeeListItem = ({
  estFiatValue,
  daysConsumed,
}: {
  estFiatValue: string;
  daysConsumed?: number;
}) => {
  const intl = useIntl();
  const [
    {
      currencyInfo: { symbol: fiatSymbol },
    },
  ] = useSettingsPersistAtom();
  console.log('daysConsumed', daysConsumed);
  const onPress = useCallback(() => {
    const description = daysConsumed
      ? `Based on the current estimated rate, it will take about ${daysConsumed} days for your earnings to cover the losses.`
      : undefined;
    Dialog.show({
      title: 'Transaction Loss',
      icon: 'InfoCircleOutline',
      description,
      renderContent: (
        <XStack>
          <SizableText size="$bodyLg">Est network fee: $1.82</SizableText>
        </XStack>
      ),
    });
  }, [daysConsumed]);
  return (
    <CalculationListItem onPress={onPress}>
      <CalculationListItem.Label>
        {intl.formatMessage({
          id: ETranslations.global_est_network_fee,
        })}
      </CalculationListItem.Label>
      <CalculationListItem.Value>
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="value"
          formatterOptions={{ currency: fiatSymbol }}
        >
          {estFiatValue}
        </NumberSizeableText>
      </CalculationListItem.Value>
    </CalculationListItem>
  );
};

export const EstimateNetworkFee = ({
  networkId,
  provider,
  symbol,
  action,
  annualRewardFiatValue,
}: {
  networkId: string;
  provider: string;
  symbol: string;
  action: IEarnEstimateAction;
  annualRewardFiatValue?: string;
}) => {
  const { result } = usePromiseResult(async () => {
    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId,
      provider,
      symbol,
      action,
      amount: '1',
    });
    return resp;
  }, [networkId, provider, symbol, action]);
  const daysConsumed = useMemo(() => {
    if (result && annualRewardFiatValue) {
      const daysBN = BigNumber(result.feeFiatValue)
        .div(annualRewardFiatValue)
        .multipliedBy(365);
      return daysBN.isNaN() ? undefined : Math.ceil(daysBN.toNumber());
    }
  }, [result, annualRewardFiatValue]);
  return result && annualRewardFiatValue ? (
    <EstimateNetworkFeeListItem
      estFiatValue={result.feeFiatValue}
      daysConsumed={daysConsumed}
    />
  ) : null;
};

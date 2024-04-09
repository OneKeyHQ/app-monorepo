import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { SizableText, YStack } from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import {
  useRateDifferenceAtom,
  useSwapAlertsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapRateDifferenceUnit,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapSelectedTokenInfo } from '../../hooks/useSwapTokens';

import SwapAccountAddressContainer from './SwapAccountAddressContainer';

interface ISwapInputContainerProps {
  direction: ESwapDirectionType;
  token?: ISwapToken;
  onAmountChange?: (value: string) => void;
  amountValue: string;
  onSelectToken: (type: ESwapDirectionType) => void;
  balance: string;
  address?: string;
  inputLoading?: boolean;
  selectTokenLoading?: boolean;
  onBalanceMaxPress?: () => void;
}

const SwapInputContainer = ({
  onAmountChange,
  direction,
  token,
  amountValue,
  selectTokenLoading,
  inputLoading,
  onSelectToken,
  onBalanceMaxPress,
  balance,
}: ISwapInputContainerProps) => {
  const { isLoading } = useSwapSelectedTokenInfo({
    token,
    type: direction,
  });
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [alerts] = useSwapAlertsAtom();
  const [rateDifference] = useRateDifferenceAtom();
  const amountPrice = useMemo(() => {
    if (!token?.price) return '0.0';
    const tokenPriceBN = new BigNumber(token.price ?? 0);
    const tokenFiatValueBN = new BigNumber(amountValue ?? 0).multipliedBy(
      tokenPriceBN,
    );
    return tokenFiatValueBN.isNaN()
      ? '0.0'
      : `${tokenFiatValueBN.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed()}`;
  }, [amountValue, token?.price]);

  const fromInputHasError = useMemo(
    () =>
      alerts?.some((item) => item.inputShowError) &&
      direction === ESwapDirectionType.FROM,
    [direction, alerts],
  );

  const valueMoreComponent = useMemo(() => {
    if (rateDifference && direction === ESwapDirectionType.TO) {
      let color = '$textSubdued';
      if (rateDifference.unit === ESwapRateDifferenceUnit.NEGATIVE) {
        color = '$textCritical';
      }
      if (rateDifference.unit === ESwapRateDifferenceUnit.POSITIVE) {
        color = '$textSuccess';
      }
      return (
        <SizableText size="$bodyMd" color={color}>
          {rateDifference.value}
        </SizableText>
      );
    }
    return null;
  }, [direction, rateDifference]);

  return (
    <YStack>
      <SwapAccountAddressContainer type={direction} />
      <AmountInput
        onChange={onAmountChange}
        value={amountValue}
        hasError={fromInputHasError}
        balanceProps={{
          value: balance,
          onPress: onBalanceMaxPress,
          loading: token && isLoading,
        }}
        valueProps={{
          value: amountPrice,
          loading: inputLoading,
          currency: settingsPersistAtom.currencyInfo.symbol,
          moreComponent: valueMoreComponent,
        }}
        inputProps={{
          loading: inputLoading,
          placeholder: '0.0',
          readOnly: direction === ESwapDirectionType.TO,
        }}
        tokenSelectorTriggerProps={{
          loading: selectTokenLoading,
          selectedNetworkImageUri: token?.networkLogoURI,
          selectedTokenImageUri: token?.logoURI,
          selectedTokenSymbol: token?.symbol,
          onPress: () => {
            onSelectToken(direction);
          },
        }}
        enableMaxAmount={direction === ESwapDirectionType.FROM}
      />
    </YStack>
  );
};

export default memo(SwapInputContainer);

import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

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
  const amountPrice = useMemo(() => {
    const currencySymbol = settingsPersistAtom.currencyInfo.symbol;
    if (!token?.price) return `${currencySymbol}0.0`;
    const tokenPriceBN = new BigNumber(token.price ?? 0);
    const tokenFiatValueBN = new BigNumber(amountValue ?? 0).multipliedBy(
      tokenPriceBN,
    );
    return tokenFiatValueBN.isNaN()
      ? `${currencySymbol}0.0`
      : `${currencySymbol}${tokenFiatValueBN
          .decimalPlaces(6, BigNumber.ROUND_DOWN)
          .toFixed()}`;
  }, [amountValue, settingsPersistAtom.currencyInfo.symbol, token?.price]);

  return (
    <YStack>
      {/* {token ? <SwapAccountAddressContainer type={direction} /> : null} */}
      <SwapAccountAddressContainer type={direction} />
      <AmountInput
        onChange={onAmountChange}
        value={amountValue}
        balanceProps={{
          value: balance,
          onPress: onBalanceMaxPress,
          loading: token && isLoading,
        }}
        valueProps={{ value: amountPrice, loading: inputLoading }}
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

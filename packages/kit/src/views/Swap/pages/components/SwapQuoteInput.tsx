import { memo } from 'react';

import BigNumber from 'bignumber.js';

import { IconButton, YStack } from '@onekeyhq/components';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapSelectedToTokenBalanceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapFromAccountNetworkSync } from '../../hooks/useSwapAccount';
import { useSwapApproving } from '../../hooks/useSwapApproving';
import { useSwapQuote } from '../../hooks/useSwapQuote';
import { useSwapQuoteLoading } from '../../hooks/useSwapState';
import { validateAmountInput } from '../../utils/utils';

import SwapInputContainer from './SwapInputContainer';

interface ISwapQuoteInputProps {
  selectLoading?: boolean;
  onSelectToken: (type: ESwapDirectionType) => void;
  onToAnotherAddressModal?: () => void;
}

const SwapQuoteInput = ({
  onSelectToken,
  selectLoading,
  onToAnotherAddressModal,
}: ISwapQuoteInputProps) => {
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const swapQuoteLoading = useSwapQuoteLoading();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const { alternationToken } = useSwapActions().current;
  const [swapQuoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const [toTokenBalance] = useSwapSelectedToTokenBalanceAtom();
  useSwapQuote();
  useSwapFromAccountNetworkSync();
  useSwapApproving();

  return (
    <YStack>
      <SwapInputContainer
        token={fromToken}
        direction={ESwapDirectionType.FROM}
        selectTokenLoading={selectLoading}
        onAmountChange={(value) => {
          if (validateAmountInput(value, fromToken?.decimals)) {
            setFromInputAmount(value);
          }
        }}
        amountValue={fromInputAmount}
        onBalanceMaxPress={() => {
          let maxAmount = fromTokenBalance;
          if (fromToken?.reservationValue) {
            const fromTokenBalanceBN = new BigNumber(fromTokenBalance);
            const fromTokenReservationValueBN = new BigNumber(
              fromToken.reservationValue,
            );
            if (
              fromTokenBalanceBN
                .minus(fromTokenReservationValueBN)
                .isGreaterThan(0)
            ) {
              maxAmount = fromTokenBalanceBN
                .minus(fromTokenReservationValueBN)
                .toFixed();
            }
          }
          setFromInputAmount(maxAmount);
        }}
        onSelectToken={onSelectToken}
        balance={fromTokenBalance}
      />
      <YStack pt="$3.5">
        <IconButton
          alignSelf="flex-end"
          icon="SwitchVerOutline"
          size="small"
          onPress={alternationToken}
          mb="$-3"
        />
        <SwapInputContainer
          token={toToken}
          inputLoading={swapQuoteLoading}
          selectTokenLoading={selectLoading}
          direction={ESwapDirectionType.TO}
          amountValue={swapQuoteCurrentSelect?.toAmount ?? ''}
          onSelectToken={onSelectToken}
          balance={toTokenBalance}
          onToAnotherAddressModal={onToAnotherAddressModal}
        />
      </YStack>
    </YStack>
  );
};

export default memo(SwapQuoteInput);

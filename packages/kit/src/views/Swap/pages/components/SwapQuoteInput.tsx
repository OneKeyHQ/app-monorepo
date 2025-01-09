import { memo } from 'react';

import BigNumber from 'bignumber.js';
import { InputAccessoryView } from 'react-native';

import { IconButton, SizableText, YStack } from '@onekeyhq/components';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectTokenDetailFetchingAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapSelectedToTokenBalanceAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ESwapDirectionType,
  SwapAmountInputAccessoryViewID,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapFromAccountNetworkSync } from '../../hooks/useSwapAccount';
import { useSwapApproving } from '../../hooks/useSwapApproving';
import { useSwapQuote } from '../../hooks/useSwapQuote';
import {
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
} from '../../hooks/useSwapState';
import { validateAmountInput } from '../../utils/utils';

import SwapInputContainer from './SwapInputContainer';

interface ISwapQuoteInputProps {
  selectLoading?: boolean;
  onSelectToken: (type: ESwapDirectionType) => void;
  onSelectPercentageStage?: (stage: number) => void;
}

const SwapQuoteInput = ({
  onSelectToken,
  selectLoading,
  onSelectPercentageStage,
}: ISwapQuoteInputProps) => {
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const swapQuoteLoading = useSwapQuoteLoading();
  const quoteEventFetching = useSwapQuoteEventFetching();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapTokenDetailLoading] = useSwapSelectTokenDetailFetchingAtom();
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
        onSelectPercentageStage={onSelectPercentageStage}
        amountValue={fromInputAmount}
        onBalanceMaxPress={() => {
          let maxAmount = fromTokenBalance;
          if (fromToken?.reservationValue) {
            const fromTokenBalanceBN = new BigNumber(fromTokenBalance ?? 0);
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
          zIndex={2}
          disabled={swapTokenDetailLoading.from || swapTokenDetailLoading.to}
          onPress={alternationToken}
          mb="$-3"
        />
        <SwapInputContainer
          token={toToken}
          inputLoading={swapQuoteLoading || quoteEventFetching}
          selectTokenLoading={selectLoading}
          direction={ESwapDirectionType.TO}
          amountValue={swapQuoteCurrentSelect?.toAmount ?? ''}
          onSelectToken={onSelectToken}
          balance={toTokenBalance}
        />
      </YStack>
      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={SwapAmountInputAccessoryViewID}>
          <SizableText h="$0" />
        </InputAccessoryView>
      ) : null}
    </YStack>
  );
};

export default memo(SwapQuoteInput);

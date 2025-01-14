import { memo, useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { InputAccessoryView } from 'react-native';

import { IconButton, SizableText, Stack, YStack } from '@onekeyhq/components';
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

  const getTransform = useCallback(() => {
    if (!platformEnv.isNative) {
      return { transform: 'translate(-50%, -50%)' };
    }
    return {
      transform: [{ translateX: -24 }, { translateY: -24 }],
    };
  }, []);

  return (
    <YStack gap="$2">
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
      <Stack
        bg="$bgApp"
        borderRadius="$full"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          zIndex: 10,
          ...getTransform(),
        }}
      >
        <IconButton
          alignSelf="center"
          bg="$bgSubdued"
          icon="SwitchVerOutline"
          size="medium"
          disabled={swapTokenDetailLoading.from || swapTokenDetailLoading.to}
          onPress={alternationToken}
          hoverStyle={{
            bg: '$bgStrongHover',
          }}
          pressStyle={{
            bg: '$bgStrongActive',
          }}
          borderRadius="$full"
          borderWidth="$1.5"
          borderColor="$bgApp"
        />
      </Stack>
      <SwapInputContainer
        token={toToken}
        inputLoading={swapQuoteLoading || quoteEventFetching}
        selectTokenLoading={selectLoading}
        direction={ESwapDirectionType.TO}
        amountValue={swapQuoteCurrentSelect?.toAmount ?? ''}
        onSelectToken={onSelectToken}
        balance={toTokenBalance}
      />

      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={SwapAmountInputAccessoryViewID}>
          <SizableText h="$0" />
        </InputAccessoryView>
      ) : null}
    </YStack>
  );
};

export default memo(SwapQuoteInput);

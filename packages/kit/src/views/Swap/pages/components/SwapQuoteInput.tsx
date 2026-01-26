import { memo, useCallback } from 'react';

import { IconButton, Stack, YStack } from '@onekeyhq/components';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectTokenDetailFetchingAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapSelectedToTokenBalanceAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapFromAccountNetworkSync } from '../../hooks/useSwapAccount';
import { useSwapLimitPriceCheck } from '../../hooks/useSwapPro';
import {
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
} from '../../hooks/useSwapState';

import SwapInputContainer from './SwapInputContainer';

interface ISwapQuoteInputProps {
  selectLoading?: boolean;
  onSelectToken: (type: ESwapDirectionType) => void;
  onSelectPercentageStage?: (stage: number) => void;
  onBalanceMaxPress?: () => void;
}

const SwapQuoteInput = ({
  onSelectToken,
  selectLoading,
  onBalanceMaxPress,
  onSelectPercentageStage,
}: ISwapQuoteInputProps) => {
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [toInputAmount, setToInputAmount] = useSwapToTokenAmountAtom();
  const swapQuoteLoading = useSwapQuoteLoading();
  const quoteEventFetching = useSwapQuoteEventFetching();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapTokenDetailLoading] = useSwapSelectTokenDetailFetchingAtom();
  const { alternationToken } = useSwapActions().current;
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const [toTokenBalance] = useSwapSelectedToTokenBalanceAtom();
  useSwapFromAccountNetworkSync();

  const getTransform = useCallback(() => {
    if (!platformEnv.isNative) {
      return { transform: 'translate(-50%, -50%)' };
    }
    return {
      transform: [{ translateX: -13 }, { translateY: -13 }], // size small
    };
  }, []);

  useSwapLimitPriceCheck(fromToken, toToken);

  return (
    <YStack gap="$2">
      <SwapInputContainer
        token={fromToken}
        direction={ESwapDirectionType.FROM}
        inputLoading={swapQuoteLoading || quoteEventFetching}
        selectTokenLoading={selectLoading}
        onAmountChange={(value) => {
          if (validateAmountInput(value, fromToken?.decimals)) {
            setFromInputAmount({
              value,
              isInput: true,
            });
          }
        }}
        onSelectPercentageStage={onSelectPercentageStage}
        amountValue={fromInputAmount.value}
        onBalanceMaxPress={onBalanceMaxPress}
        onSelectToken={onSelectToken}
        balance={fromTokenBalance}
      />
      <Stack
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
          bg="$bgApp"
          variant="tertiary"
          icon="SwapVerOutline"
          iconProps={{
            color: '$icon',
          }}
          size="small"
          disabled={swapTokenDetailLoading.from || swapTokenDetailLoading.to}
          onPress={alternationToken}
          borderWidth="$1"
          cursor="pointer"
          hoverStyle={{}}
          pressStyle={{}}
          opacity={1}
        />
      </Stack>
      <SwapInputContainer
        token={toToken}
        inputLoading={swapQuoteLoading || quoteEventFetching}
        selectTokenLoading={selectLoading}
        direction={ESwapDirectionType.TO}
        onAmountChange={(value) => {
          if (validateAmountInput(value, toToken?.decimals)) {
            setToInputAmount({
              value,
              isInput: true,
            });
          }
        }}
        amountValue={toInputAmount.value}
        onSelectToken={onSelectToken}
        balance={toTokenBalance}
      />
    </YStack>
  );
};

export default memo(SwapQuoteInput);

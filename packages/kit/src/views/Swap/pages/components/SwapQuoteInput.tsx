import { memo, useCallback, useEffect } from 'react';

import BigNumber from 'bignumber.js';

import { IconButton, Stack, YStack } from '@onekeyhq/components';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapLimitPriceFromAmountAtom,
  useSwapLimitPriceToAmountAtom,
  useSwapNativeTokenReserveGasAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectTokenDetailFetchingAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapSelectedToTokenBalanceAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapFromAccountNetworkSync } from '../../hooks/useSwapAccount';
import { useSwapQuote } from '../../hooks/useSwapQuote';
import {
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
} from '../../hooks/useSwapState';

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
  const [toInputAmount, setToInputAmount] = useSwapToTokenAmountAtom();
  const swapQuoteLoading = useSwapQuoteLoading();
  const quoteEventFetching = useSwapQuoteEventFetching();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapTokenDetailLoading] = useSwapSelectTokenDetailFetchingAtom();
  const { alternationToken } = useSwapActions().current;
  const [swapQuoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const [toTokenBalance] = useSwapSelectedToTokenBalanceAtom();
  const [swapLimitPriceFromAmount] = useSwapLimitPriceFromAmountAtom();
  const [swapLimitPriceToAmount] = useSwapLimitPriceToAmountAtom();
  const [swapTypeSwitchValue] = useSwapTypeSwitchAtom();
  const [swapNativeTokenReserveGas] = useSwapNativeTokenReserveGasAtom();
  useSwapQuote();
  useSwapFromAccountNetworkSync();

  const getTransform = useCallback(() => {
    if (!platformEnv.isNative) {
      return { transform: 'translate(-50%, -50%)' };
    }
    return {
      transform: [{ translateX: -13 }, { translateY: -13 }], // size small
    };
  }, []);

  useEffect(() => {
    if (
      swapTypeSwitchValue === ESwapTabSwitchType.LIMIT &&
      swapLimitPriceFromAmount
    ) {
      setFromInputAmount({
        value: swapLimitPriceFromAmount,
        isInput: false,
      });
    }
  }, [setFromInputAmount, swapLimitPriceFromAmount, swapTypeSwitchValue]);

  useEffect(() => {
    if (
      swapTypeSwitchValue === ESwapTabSwitchType.LIMIT &&
      swapLimitPriceToAmount
    ) {
      setToInputAmount({
        value: swapLimitPriceToAmount,
        isInput: false,
      });
    }
  }, [setToInputAmount, swapLimitPriceToAmount, swapTypeSwitchValue]);

  useEffect(() => {
    if (
      swapTypeSwitchValue !== ESwapTabSwitchType.LIMIT ||
      checkWrappedTokenPair({
        fromToken,
        toToken,
      })
    ) {
      let toAmount = '';
      if (
        equalTokenNoCaseSensitive({
          token1: fromToken,
          token2: swapQuoteCurrentSelect?.fromTokenInfo,
        }) &&
        equalTokenNoCaseSensitive({
          token1: toToken,
          token2: swapQuoteCurrentSelect?.toTokenInfo,
        })
      ) {
        toAmount = swapQuoteCurrentSelect?.toAmount ?? '';
      }
      if (
        checkWrappedTokenPair({
          fromToken,
          toToken,
        })
      ) {
        toAmount = swapQuoteCurrentSelect?.isWrapped
          ? swapQuoteCurrentSelect?.toAmount ?? ''
          : '';
      }
      setToInputAmount({
        value: toAmount,
        isInput: false,
      });
    }
  }, [
    swapQuoteCurrentSelect?.toAmount,
    swapQuoteCurrentSelect?.fromTokenInfo,
    swapQuoteCurrentSelect?.toTokenInfo,
    swapQuoteCurrentSelect?.isWrapped,
    setToInputAmount,
    setFromInputAmount,
    swapTypeSwitchValue,
    fromToken,
    toToken,
  ]);

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
        onBalanceMaxPress={() => {
          let maxAmount = new BigNumber(fromTokenBalance ?? 0);
          if (fromToken?.isNative) {
            const reserveGas = swapNativeTokenReserveGas.find(
              (item) => item.networkId === fromToken.networkId,
            )?.reserveGas;
            if (reserveGas) {
              maxAmount = BigNumber.max(
                0,
                maxAmount.minus(new BigNumber(reserveGas)),
              );
            }
          }
          setFromInputAmount({
            value: maxAmount.toFixed(),
            isInput: true,
          });
        }}
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

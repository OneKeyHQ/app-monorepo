import { memo, useCallback, useState } from 'react';

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
import { getSwapDisplayDecimals } from '@onekeyhq/kit/src/views/Swap/utils/swapAmountUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapFromAccountNetworkSync } from '../../hooks/useSwapAccount';
import { useSwapLimitPriceCheck } from '../../hooks/useSwapPro';
import { useSwapQuoteProgressState } from '../../hooks/useSwapState';
import { SwapTestIDs } from '../../testIDs';

import SwapInputContainer, { SWAP_RAISED_SHADOW } from './SwapInputContainer';

import type { LayoutChangeEvent } from 'react-native';

// Half of the $2 gap between the two cards.
const SWAP_CARDS_HALF_GAP = 4;

interface ISwapQuoteInputProps {
  selectLoading?: boolean;
  onSelectToken: (type: ESwapDirectionType) => void;
  onSelectPercentageStage?: (stage: number) => void;
  onBalanceMaxPress?: () => void;
  autoFocusFromInput?: boolean;
}

const SwapQuoteInput = ({
  onSelectToken,
  selectLoading,
  onBalanceMaxPress,
  onSelectPercentageStage,
  autoFocusFromInput,
}: ISwapQuoteInputProps) => {
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [toInputAmount, setToInputAmount] = useSwapToTokenAmountAtom();
  const { isQuotePresentationLoading } = useSwapQuoteProgressState();
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

  // The cards have different heights, so the seam between them is measured
  // rather than assumed to be the vertical center.
  const [cardsSeamY, setCardsSeamY] = useState<number>();
  const handleFromCardLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setCardsSeamY(y + height + SWAP_CARDS_HALF_GAP);
  }, []);

  return (
    <YStack gap="$2">
      <Stack onLayout={handleFromCardLayout}>
        <SwapInputContainer
          autoFocusOnPageFocus={autoFocusFromInput}
          token={fromToken}
          direction={ESwapDirectionType.FROM}
          inputLoading={isQuotePresentationLoading}
          selectTokenLoading={selectLoading}
          onAmountChange={(value) => {
            if (
              validateAmountInput(
                value,
                getSwapDisplayDecimals(
                  fromToken?.decimals,
                  fromToken?.balanceMultiplier,
                ),
              )
            ) {
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
          balanceLoading={swapTokenDetailLoading.from}
        />
      </Stack>
      {cardsSeamY === undefined ? null : (
        <Stack
          borderRadius="$full"
          style={{
            position: 'absolute',
            top: cardsSeamY,
            left: '50%',
            zIndex: 10,
            ...getTransform(),
          }}
        >
          <IconButton
            testID={SwapTestIDs.switchTokensButton}
            alignSelf="center"
            bg="$bgApp"
            variant="tertiary"
            // A one-way arrow shows the trade direction; pressing it still
            // swaps the two tokens.
            icon="ArrowBottomOutline"
            iconProps={{
              color: '$icon',
            }}
            size="small"
            disabled={swapTokenDetailLoading.from || swapTokenDetailLoading.to}
            onPress={alternationToken}
            borderWidth="$1"
            // Raised like the pay card it overlaps.
            {...(platformEnv.isNative ? {} : { boxShadow: SWAP_RAISED_SHADOW })}
            cursor="pointer"
            hoverStyle={{}}
            pressStyle={{}}
            opacity={1}
          />
        </Stack>
      )}
      <SwapInputContainer
        token={toToken}
        inputLoading={isQuotePresentationLoading}
        selectTokenLoading={selectLoading}
        direction={ESwapDirectionType.TO}
        onAmountChange={(value) => {
          if (
            validateAmountInput(
              value,
              getSwapDisplayDecimals(
                toToken?.decimals,
                toToken?.balanceMultiplier,
              ),
            )
          ) {
            setToInputAmount({
              value,
              isInput: true,
            });
          }
        }}
        amountValue={toInputAmount.value}
        onSelectToken={onSelectToken}
        balance={toTokenBalance}
        balanceLoading={swapTokenDetailLoading.to}
      />
    </YStack>
  );
};

export default memo(SwapQuoteInput);

import { memo, useCallback } from 'react';

import { Dialog, NumberSizeableText, YStack } from '@onekeyhq/components';
import {
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippageDialogOpeningAtom,
  useSwapSlippagePercentageAtom,
  useSwapSlippagePercentageCustomValueAtom,
  useSwapSlippagePercentageModeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ESwapSlippageSegmentKey,
  type IFetchQuoteResult,
  type ISwapSlippageSegmentItem,
} from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import SwapProviderInfoItem from '../../components/SwapProviderInfoItem';
import { useSwapQuoteLoading } from '../../hooks/useSwapState';

import SwapApproveAllowanceSelectContainer from './SwapApproveAllowanceSelectContainer';
import SwapSlippageContentContainer from './SwapSlippageContentContainer';
import SwapSlippageTriggerContainer from './SwapSlippageTriggerContainer';

interface ISwapQuoteResultProps {
  receivedAddress?: string;
  quoteResult: IFetchQuoteResult;
  onOpenProviderList?: () => void;
}

const SwapQuoteResult = ({
  onOpenProviderList,
  quoteResult,
}: ISwapQuoteResultProps) => {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const swapQuoteLoading = useSwapQuoteLoading();

  const [, setSwapSlippageDialogOpening] = useSwapSlippageDialogOpeningAtom();
  const [swapSlippage] = useSwapSlippagePercentageAtom();
  const [, setSwapSlippageCustomValue] =
    useSwapSlippagePercentageCustomValueAtom();
  const [, setSwapSlippageMode] = useSwapSlippagePercentageModeAtom();

  const slippageOnSave = useCallback(
    (slippageItem: ISwapSlippageSegmentItem) => {
      setSwapSlippageMode(slippageItem.key);
      if (slippageItem.key === ESwapSlippageSegmentKey.CUSTOM) {
        setSwapSlippageCustomValue(slippageItem.value);
      }
    },
    [setSwapSlippageCustomValue, setSwapSlippageMode],
  );

  const slippageHandleClick = useCallback(() => {
    Dialog.confirm({
      title: 'Slippage tolerance',
      // onConfirmText: 'Save',
      // onConfirm: slippageOnSave,
      renderContent: (
        <SwapSlippageContentContainer
          swapSlippage={swapSlippage}
          onSave={slippageOnSave}
        />
      ),
      onOpenChange: (open) => {
        setSwapSlippageDialogOpening(open);
      },
    });
  }, [setSwapSlippageDialogOpening, slippageOnSave, swapSlippage]);

  return (
    <YStack space="$4">
      {quoteResult.allowanceResult ? (
        <SwapApproveAllowanceSelectContainer
          allowanceResult={quoteResult.allowanceResult}
          fromTokenSymbol={fromToken?.symbol ?? ''}
          isLoading={swapQuoteLoading}
        />
      ) : null}
      {quoteResult.info.provider ? (
        <SwapProviderInfoItem
          providerIcon={quoteResult.info.providerLogo ?? ''} // TODO default logo
          isLoading={swapQuoteLoading}
          rate={quoteResult.instantRate}
          fromToken={fromToken}
          toToken={toToken}
          showBest={quoteResult.isBest}
          showLock={!!quoteResult.allowanceResult}
          onPress={() => {
            onOpenProviderList?.();
          }}
        />
      ) : null}
      {quoteResult.toAmount &&
      !quoteResult.allowanceResult &&
      !quoteResult.unSupportSlippage ? (
        <SwapSlippageTriggerContainer
          isLoading={swapQuoteLoading}
          onPress={slippageHandleClick}
        />
      ) : null}
      {quoteResult.fee?.estimatedFeeFiatValue ? (
        <SwapCommonInfoItem
          title="Est network fee"
          isLoading={swapQuoteLoading}
          valueComponent={
            <NumberSizeableText
              size="$bodyMdMedium"
              formatter="value"
              formatterOptions={{
                currency: settingsPersistAtom.currencyInfo.symbol,
              }}
            >
              {quoteResult.fee?.estimatedFeeFiatValue}
            </NumberSizeableText>
          }
        />
      ) : null}
    </YStack>
  );
};

export default memo(SwapQuoteResult);

import { memo } from 'react';

import { NumberSizeableText, YStack } from '@onekeyhq/components';
import {
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippagePopoverOpeningAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import SwapProviderInfoItem from '../../components/SwapProviderInfoItem';
import { useSwapQuoteLoading } from '../../hooks/useSwapState';
import { SwapProviderMirror } from '../SwapProviderMirror';

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

  const [, setSwapSlippagePopOverOpening] = useSwapSlippagePopoverOpeningAtom();

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
      {!quoteResult.allowanceResult ? (
        <SwapSlippageTriggerContainer
          isLoading={swapQuoteLoading}
          renderPopoverContent={() => (
            <SwapProviderMirror>
              <SwapSlippageContentContainer />
            </SwapProviderMirror>
          )}
          popoverOnOpenChange={(open) => {
            setSwapSlippagePopOverOpening(open);
          }}
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

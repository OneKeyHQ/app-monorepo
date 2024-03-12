import { memo, useCallback, useMemo } from 'react';

import { NumberSizeableText, Popover, YStack } from '@onekeyhq/components';
import {
  useSwapQuoteApproveAllowanceUnLimitAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteFetchingAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippagePopoverOpeningAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ESwapApproveAllowanceType } from '@onekeyhq/shared/types/swap/types';

import SwapApproveAllowanceSelect from '../../components/SwapApproveAllowanceSelect';
import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import SwapProviderInfoItem from '../../components/SwapProviderInfoItem';

import SwapSlippageContentContainer from './SwapSlippageContentContainer';
import SwapSlippageTriggerContainer from './SwapSlippageTriggerContainer';

interface ISwapQuoteResultProps {
  receivedAddress?: string;
  onOpenProviderList?: () => void;
}

const SwapQuoteResult = ({ onOpenProviderList }: ISwapQuoteResultProps) => {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [quoteResult] = useSwapQuoteCurrentSelectAtom();
  const [quoteFetching] = useSwapQuoteFetchingAtom();
  const [, setSwapQuoteApproveAllowanceUnLimit] =
    useSwapQuoteApproveAllowanceUnLimitAtom();

  const [, setSwapSlippagePopOverOpening] = useSwapSlippagePopoverOpeningAtom();

  const approveAllowanceSelectItems = useMemo(() => {
    if (quoteResult?.allowanceResult) {
      return [
        {
          label: `${quoteResult.allowanceResult.amount} ${
            fromToken?.symbol ?? ''
          }`,
          value: ESwapApproveAllowanceType.PRECISION,
        },
        {
          label: 'Unlimited',
          value: ESwapApproveAllowanceType.UN_LIMIT,
        },
      ];
    }
    return [];
  }, [fromToken?.symbol, quoteResult?.allowanceResult]);

  const onSelectAllowanceValue = useCallback(
    (value: string) => {
      setSwapQuoteApproveAllowanceUnLimit(
        value === ESwapApproveAllowanceType.UN_LIMIT,
      );
    },
    [setSwapQuoteApproveAllowanceUnLimit],
  );

  return !quoteResult ? null : (
    <YStack space="$4">
      {quoteResult.allowanceResult ? (
        <SwapApproveAllowanceSelect
          onSelectAllowanceValue={onSelectAllowanceValue}
          selectItems={approveAllowanceSelectItems}
          isLoading={quoteFetching}
        />
      ) : null}
      <SwapProviderInfoItem
        providerName={quoteResult.info.providerName}
        providerIcon={quoteResult.info.providerLogo ?? ''} // TODO default logo
        isLoading={quoteFetching}
        rate={quoteResult.instantRate}
        fromToken={fromToken}
        toToken={toToken}
        showBest={quoteResult.isBest}
        showLock={!!quoteResult.allowanceResult}
        onPress={() => {
          onOpenProviderList?.();
        }}
      />
      {!quoteResult.allowanceResult ? (
        <YStack space="$4">
          <Popover
            title="Slippage tolerance"
            onOpenChange={(open) => {
              setSwapSlippagePopOverOpening(open);
            }}
            renderTrigger={
              <SwapSlippageTriggerContainer isLoading={quoteFetching} />
            }
            renderContent={() => <SwapSlippageContentContainer />}
            keepChildrenMounted
          />
          {quoteResult.fee.estimatedFeeFiatValue ? (
            <SwapCommonInfoItem
              title="Est network fee"
              isLoading={quoteFetching}
              valueComponent={
                <NumberSizeableText
                  formatter="value"
                  formatterOptions={{
                    currency: settingsPersistAtom.currencyInfo.symbol,
                  }}
                >
                  {quoteResult.fee.estimatedFeeFiatValue}
                </NumberSizeableText>
              }
            />
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
};

export default memo(SwapQuoteResult);

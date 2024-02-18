import { memo, useCallback, useMemo, useState } from 'react';

import { ISelectItem, YStack } from '@onekeyhq/components';
import {
  useSwapQuoteApproveAllowanceUnLimitAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import SwapProviderInfoItem from '../../components/SwapProviderInfoItem';
import SwapRateInfoItem from '../../components/SwapRateInfoItem';
import { useSwapQuote } from '../../hooks/useSwapQuote';
import SwapApproveAllowanceSelect from '../../components/SwapApproveAllowanceSelect';
import { ESwapApproveAllowanceType } from '../../types';

interface ISwapQuoteResultProps {
  receivedAddress?: string;
  onOpenProviderList?: () => void;
}

const SwapQuoteResult = ({
  receivedAddress,
  onOpenProviderList,
}: ISwapQuoteResultProps) => {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [quoteResult] = useSwapQuoteCurrentSelectAtom();
  const { quoteFetching } = useSwapQuote();
  const [, setSwapQuoteApproveAllowanceUnLimit] =
    useSwapQuoteApproveAllowanceUnLimitAtom();
  const protocolFee = useMemo<string | undefined>(
    () =>
      // TODO: calculate protocol fee fetch price api
      undefined,
    [],
  );

  const approveAllowanceSelectItems = useMemo(() => {
    if (quoteResult?.allowanceResult) {
      return [
        {
          label: `${quoteResult.allowanceResult.amount} ${fromToken?.symbol}`,
          value: ESwapApproveAllowanceType.PRECISION,
        },
        {
          label: 'Unlimited',
          value: ESwapApproveAllowanceType.UN_LIMIT,
        },
      ];
    }
    return [];
  }, [quoteResult]);

  const onSelectAllowanceValue = useCallback((value: string) => {
    setSwapQuoteApproveAllowanceUnLimit(
      value === ESwapApproveAllowanceType.UN_LIMIT,
    );
  }, []);

  return !quoteResult ? null : (
    <YStack
      m="$4"
      p="$2"
      space="$4"
      borderRadius="$4"
      borderColor="$bgPrimaryActive"
      borderWidth="$0.5"
    >
      {quoteResult.allowanceResult && (
        <SwapApproveAllowanceSelect
          onSelectAllowanceValue={onSelectAllowanceValue}
          selectItems={approveAllowanceSelectItems}
        />
      )}
      <SwapRateInfoItem
        rate={quoteResult.instantRate}
        isLoading={quoteFetching}
        fromToken={fromToken}
        toToken={toToken}
      />
      <SwapProviderInfoItem
        providerName={quoteResult.info.providerName}
        providerIcon={quoteResult.info.providerLogo ?? ''} // TODO default logo
        isLoading={quoteFetching}
        showBest={quoteResult.isBest}
        showLock={!!quoteResult.allowanceResult}
        onPress={() => {
          onOpenProviderList?.();
        }}
      />
      {protocolFee && (
        <SwapCommonInfoItem
          title="Protocol Fee"
          value={`$${protocolFee}`}
          isLoading={quoteFetching}
        />
      )}
      <SwapCommonInfoItem
        title="Onekey Fee"
        value={`%${quoteResult.fee.percentageFee}`}
        isLoading={quoteFetching}
      />
      {receivedAddress && (
        <SwapCommonInfoItem
          title="Received Address"
          value={receivedAddress}
          onPress={() => {
            // TODO open account select
          }}
        />
      )}
    </YStack>
  );
};

export default memo(SwapQuoteResult);

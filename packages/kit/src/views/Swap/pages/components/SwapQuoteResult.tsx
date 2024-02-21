import { memo, useCallback, useMemo } from 'react';

import { YStack } from '@onekeyhq/components';
import {
  useSwapQuoteApproveAllowanceUnLimitAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteFetchingAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapApproveAllowanceType } from '@onekeyhq/shared/types/swap/types';

import SwapApproveAllowanceSelect from '../../components/SwapApproveAllowanceSelect';
import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';
import SwapProviderInfoItem from '../../components/SwapProviderInfoItem';
import SwapRateInfoItem from '../../components/SwapRateInfoItem';

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
  const [quoteFetching] = useSwapQuoteFetchingAtom();
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
          isLoading={quoteFetching}
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

import { memo, useMemo } from 'react';

import { YStack } from '@onekeyhq/components';

import {
  useSwapResultQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';
import SwapCommonInfoItem from '../Components/SwapCommonInfoItem';
import SwapProviderInfoItem from '../Components/SwapProviderInfoItem';
import SwapRateInfoItem from '../Components/SwapRateInfoItem';
import { useSwapQuote } from '../hooks/useSwapQuote';

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
  const [quoteResult] = useSwapResultQuoteCurrentSelectAtom();
  const { quoteFetching } = useSwapQuote();

  const protocolFee = useMemo<string | undefined>(
    () =>
      // TODO: calculate protocol fee fetch price api
      undefined,
    [],
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

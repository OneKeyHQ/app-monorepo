import { memo, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import { YStack } from '@onekeyhq/components';

import {
  useSwapResultQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '../../../states/jotai/contexts/swap';
import SwapQuoteResultCell from '../components/SwapQuoteResultCell';
import { useSwapQuote } from '../hooks/useSwapQuote';

interface ISwapQuoteResultProps {
  receivedAddress?: string;
  onOpenProviderList?: () => void;
}

const SwapQuoteResult = ({
  receivedAddress,
  onOpenProviderList,
}: ISwapQuoteResultProps) => {
  const [rateCalculateReverse, setRateCalculateReverse] = useState(false);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [quoteResult] = useSwapResultQuoteCurrentSelectAtom();
  const { quoteFetching } = useSwapQuote();
  const rate = useMemo(() => {
    if (!quoteResult) return '-';
    const instanceRate = new BigNumber(quoteResult?.instantRate);
    const oneBN = new BigNumber(1);
    if (!instanceRate.isNaN() && fromToken && toToken) {
      return !rateCalculateReverse
        ? `1 ${fromToken?.symbol} = ${instanceRate.toFixed()} ${
            toToken?.symbol
          }`
        : `1 ${toToken?.symbol} = ${oneBN
            .dividedBy(instanceRate)
            .decimalPlaces(6, BigNumber.ROUND_DOWN)
            .toFixed()} ${fromToken?.symbol}`;
    }
    return '-';
  }, [fromToken, quoteResult, rateCalculateReverse, toToken]);

  const protocolFee = useMemo(
    () =>
      // TODO: calculate protocol fee fetch price api
      undefined,
    [],
  );

  return !quoteResult ? null : (
    <YStack
      m="$4"
      p="$2"
      borderRadius="$4"
      borderColor="$bgPrimaryActive"
      borderWidth="$0.5"
    >
      <SwapQuoteResultCell
        onPress={() => {
          setRateCalculateReverse((pre) => !pre);
        }}
        title="Rate"
        value={rate}
        loading={quoteFetching}
      />
      <SwapQuoteResultCell
        title="Provider"
        value={quoteResult.info.providerName ?? quoteResult.info.provider}
        loading={quoteFetching}
        onPress={() => {
          // TODO: open provider list modal
          onOpenProviderList?.();
        }}
      />
      {protocolFee && (
        <SwapQuoteResultCell
          title="Protocol Fee"
          value={protocolFee}
          loading={quoteFetching}
        />
      )}
      <SwapQuoteResultCell
        title="Onekey Fee"
        value={`%${quoteResult.fee.percentageFee}`}
        loading={quoteFetching}
      />
      {receivedAddress && (
        <SwapQuoteResultCell title="Received Address" value={receivedAddress} />
      )}
    </YStack>
  );
};

export default memo(SwapQuoteResult);

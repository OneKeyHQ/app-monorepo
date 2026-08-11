import { useCallback } from 'react';

import { YStack } from '@onekeyhq/components';
import {
  useSwapProSelectTokenAtom,
  useSwapProTimeRangeAtom,
  useSwapProTokenMarketDetailInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  type ESwapProTimeRange,
  swapProTimeRangeItems,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import SwapProBuySellInfo from '../../components/SwapProBuySellInfo';
import SwapProTimeRangeSelector from '../../components/SwapProTimeRangeSelector';
import { SwapTestIDs } from '../../testIDs';
import { isSwapProHyperliquidBtcToken } from '../../utils/swapProTransactionSource';

const SwapProBuySellGroup = ({
  supportSpeedSwap,
}: {
  supportSpeedSwap?: boolean;
}) => {
  const [swapProTokenMarketDetailInfo] = useSwapProTokenMarketDetailInfoAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProTimeRange, setSwapProTimeRange] = useSwapProTimeRangeAtom();
  const isHyperliquidBtc = isSwapProHyperliquidBtcToken(swapProSelectToken);
  const handleTimeRangeChange = useCallback(
    (value: ESwapProTimeRange) => {
      if (value === swapProTimeRange.value) {
        return;
      }
      setSwapProTimeRange({
        label:
          swapProTimeRangeItems.find((item) => item.value === value)?.label ??
          '',
        value,
      });
      defaultLogger.swap.swapPro.swapProTimeRangeChange({
        fromRange: swapProTimeRange.value,
        toRange: value,
        tokenSymbol: swapProSelectToken?.symbol ?? '',
      });
    },
    [setSwapProTimeRange, swapProSelectToken?.symbol, swapProTimeRange.value],
  );
  return (
    <YStack testID={SwapTestIDs.proBuySellGroup} gap="$2">
      {isHyperliquidBtc ? null : (
        <SwapProBuySellInfo
          supportSpeedSwap={supportSpeedSwap}
          tokenDetailInfo={swapProTokenMarketDetailInfo}
          timeRange={swapProTimeRange.value}
        />
      )}
      <SwapProTimeRangeSelector
        disabled={!supportSpeedSwap ? !isHyperliquidBtc : false}
        items={swapProTimeRangeItems}
        selectedValue={swapProTimeRange}
        onChange={handleTimeRangeChange}
      />
    </YStack>
  );
};

export default SwapProBuySellGroup;

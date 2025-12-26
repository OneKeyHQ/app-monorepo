import { YStack } from '@onekeyhq/components';
import {
  useSwapProSelectTokenAtom,
  useSwapProTimeRangeAtom,
  useSwapProTokenMarketDetailInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { swapProTimeRangeItems } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import SwapProBuySellInfo from '../../components/SwapProBuySellInfo';
import SwapProTimeRangeSelector from '../../components/SwapProTimeRangeSelector';

const SwapProBuySellGroup = () => {
  const [swapProTokenMarketDetailInfo] = useSwapProTokenMarketDetailInfoAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProTimeRange, setSwapProTimeRange] = useSwapProTimeRangeAtom();
  return (
    <YStack gap="$2">
      <SwapProBuySellInfo
        isNative={swapProSelectToken?.isNative}
        tokenDetailInfo={swapProTokenMarketDetailInfo}
        timeRange={swapProTimeRange.value}
      />
      <SwapProTimeRangeSelector
        isNative={swapProSelectToken?.isNative}
        items={swapProTimeRangeItems}
        selectedValue={swapProTimeRange}
        onChange={(value) =>
          setSwapProTimeRange({
            label:
              swapProTimeRangeItems.find((item) => item.value === value)
                ?.label ?? '',
            value,
          })
        }
      />
    </YStack>
  );
};

export default SwapProBuySellGroup;

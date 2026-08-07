import { YStack } from '@onekeyhq/components';
import {
  useSwapProSelectTokenAtom,
  useSwapProTimeRangeAtom,
  useSwapProTokenMarketDetailInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { swapProTimeRangeItems } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

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

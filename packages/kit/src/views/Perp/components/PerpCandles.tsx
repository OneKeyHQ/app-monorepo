import { DebugRenderTracker, Stack } from '@onekeyhq/components';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAssetAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function PerpCandles() {
  const [currentToken] = usePerpsActiveAssetAtom();
  const [currentAccount] = usePerpsActiveAccountAtom();

  const content = (
    <Stack w="100%" h="100%">
      <TradingViewPerpsV2
        userAddress={currentAccount?.accountAddress}
        symbol={currentToken.coin}
      />
    </Stack>
  );
  return (
    <DebugRenderTracker
      containerStyle={{
        width: '100%',
        height: '100%',
        flex: 1,
      }}
      name="PerpCandles"
      position="top-right"
    >
      {content}
    </DebugRenderTracker>
  );
}

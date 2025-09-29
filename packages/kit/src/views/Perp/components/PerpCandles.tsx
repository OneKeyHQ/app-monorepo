import { Stack } from '@onekeyhq/components';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAssetAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function PerpCandles() {
  const [currentToken] = usePerpsActiveAssetAtom();
  const [currentAccount] = usePerpsActiveAccountAtom();

  return (
    <Stack w="100%" h="100%">
      <TradingViewPerpsV2
        userAddress={currentAccount?.accountAddress}
        symbol={currentToken.coin}
      />
    </Stack>
  );
}

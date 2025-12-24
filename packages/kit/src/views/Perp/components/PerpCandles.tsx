import { DebugRenderTracker, Stack } from '@onekeyhq/components';
import { TradingViewPerpsV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAssetAtom,
  usePerpsCandlesWebviewReloadHookAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function PerpCandles() {
  const [currentToken] = usePerpsActiveAssetAtom();
  const [currentAccount] = usePerpsActiveAccountAtom();
  const [{ reloadHook }] = usePerpsCandlesWebviewReloadHookAtom();

  const content = (
    <Stack w="100%" h="100%" flex={1} pr={6}>
      {reloadHook > 0 ? (
        <TradingViewPerpsV2
          webviewKey={reloadHook.toString()}
          userAddress={currentAccount?.accountAddress}
          symbol={currentToken.coin}
        />
      ) : null}
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

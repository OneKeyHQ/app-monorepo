import { Page, Text, YStack } from '@onekeyhq/components';

import { useSwapBuildTxResultAtom } from '../../../../states/jotai/contexts/swap';
import { withSwapProvider } from '../WithSwapProvider';

const SwapBuildTxDemo = () => {
  const [swapBuildTxResult] = useSwapBuildTxResultAtom();
  if (!swapBuildTxResult) return null;
  return (
    <Page>
      <YStack space="$4">
        <Text>{`Provider: ${swapBuildTxResult.result.info.providerName}`}</Text>
        <Text>{`toAmount(after onekey fee): ${swapBuildTxResult.result.toAmount}`}</Text>
        <Text>{`instantRate: ${swapBuildTxResult.result.instantRate}`}</Text>
        {swapBuildTxResult.tx && (
          <>
            <Text mt="$4">Transaction</Text>
            <Text>{`to: ${swapBuildTxResult.tx.to}`}</Text>
            <Text>{`value: ${swapBuildTxResult.tx.value}`}</Text>
            <Text>{`data: ${swapBuildTxResult.tx.data}`}</Text>
          </>
        )}

        {swapBuildTxResult.swftOrder && (
          <>
            <Text mt="$4">Swft order</Text>
            <Text>{`orderId: ${swapBuildTxResult.swftOrder.orderId}`}</Text>
            <Text>{`platformAddr: ${swapBuildTxResult.swftOrder.platformAddr}`}</Text>
            <Text>{`depositCoinCode: ${swapBuildTxResult.swftOrder.depositCoinCode}`}</Text>
            <Text>{`depositCoinAmt: ${swapBuildTxResult.swftOrder.depositCoinAmt}`}</Text>
          </>
        )}
      </YStack>
    </Page>
  );
};

export default withSwapProvider(SwapBuildTxDemo);

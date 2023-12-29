import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, Page, Text, YStack } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { useSwapBuildTxResultAtom } from '../../../../states/jotai/contexts/swap';
import { useSwapTxHistoryActions } from '../../hooks/useSwapTxHistory';
import { withSwapProvider } from '../WithSwapProvider';

import type { IModalSwapParamList } from '../../router/Routers';

const SwapBuildTxDemo = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [swapBuildTxResult] = useSwapBuildTxResultAtom();
  const { generateSwapHistoryItem } = useSwapTxHistoryActions();
  if (!swapBuildTxResult) return null;
  return (
    <Page scrollEnabled>
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
        <Button
          onPress={async () => {
            await generateSwapHistoryItem({
              txId: '0x15b67f7943226e9f60679d71ea6563124628eb2064b6ee9e9cc6abda6e5747c2',
              netWorkFee: '8888',
            });
            navigation.pop();
          }}
        >
          Confirm
        </Button>
      </YStack>
    </Page>
  );
};

export default withSwapProvider(SwapBuildTxDemo);

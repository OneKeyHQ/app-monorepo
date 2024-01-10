import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, Page, SizableText, YStack } from '@onekeyhq/components';

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
        <SizableText>{`Provider: ${swapBuildTxResult.result.info.providerName}`}</SizableText>
        <SizableText>{`toAmount(after onekey fee): ${swapBuildTxResult.result.toAmount}`}</SizableText>
        <SizableText>{`instantRate: ${swapBuildTxResult.result.instantRate}`}</SizableText>
        {swapBuildTxResult.tx && (
          <>
            <SizableText mt="$4">Transaction</SizableText>
            <SizableText>{`to: ${swapBuildTxResult.tx.to}`}</SizableText>
            <SizableText>{`value: ${swapBuildTxResult.tx.value}`}</SizableText>
            <SizableText>{`data: ${swapBuildTxResult.tx.data}`}</SizableText>
          </>
        )}

        {swapBuildTxResult.swftOrder && (
          <>
            <SizableText mt="$4">Swft order</SizableText>
            <SizableText>{`orderId: ${swapBuildTxResult.swftOrder.orderId}`}</SizableText>
            <SizableText>{`platformAddr: ${swapBuildTxResult.swftOrder.platformAddr}`}</SizableText>
            <SizableText>{`depositCoinCode: ${swapBuildTxResult.swftOrder.depositCoinCode}`}</SizableText>
            <SizableText>{`depositCoinAmt: ${swapBuildTxResult.swftOrder.depositCoinAmt}`}</SizableText>
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

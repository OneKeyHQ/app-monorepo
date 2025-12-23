import { useMemo } from 'react';

import { ActionList, Button, IconButton, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

import { useBorrowContext } from '../../BorrowProvider';
import { useSupplyActions } from '../../hooks/useSupplyActions';

import type { IAssetWithToken } from '../../hooks/useSupplyActions';

type IActionFieldProps = {
  item: IAssetWithToken;
  onPress?: (item: IAssetWithToken) => void;
  needAdditionButton?: boolean;
  buttonText: React.ReactNode;
};

export const ActionField = ({
  item,
  onPress,
  needAdditionButton = false,
  buttonText,
}: IActionFieldProps) => {
  const { market } = useBorrowContext();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const networkId = market?.networkId || '';

  const { handleSwap, handleBridge, handleReceive } = useSupplyActions({
    accountId: activeAccount?.account?.id || '',
    walletId: activeAccount?.wallet?.id || '',
    networkId,
    indexedAccountId: activeAccount?.indexedAccount?.id,
  });

  const { result: swapConfig } = usePromiseResult(
    async () => {
      if (!networkId) {
        return { isSupportSwap: false, isSupportCrossChain: false };
      }
      return backgroundApiProxy.serviceSwap.checkSupportSwap({
        networkId,
      });
    },
    [networkId],
    { initResult: { isSupportSwap: false, isSupportCrossChain: false } },
  );

  const actionItems = useMemo(() => {
    const items: {
      icon: 'SwapHorOutline' | 'BridgeOutline' | 'ArrowBottomOutline';
      label: string;
      onPress: () => void;
    }[] = [];

    if (swapConfig.isSupportSwap || swapConfig.isSupportCrossChain) {
      items.push({
        icon: 'SwapHorOutline',
        label: 'Swap',
        onPress: () => {
          void handleSwap?.(item);
        },
      });
    }

    if (swapConfig.isSupportCrossChain) {
      items.push({
        icon: 'BridgeOutline',
        label: 'Bridge',
        onPress: () => {
          void handleBridge?.(item);
        },
      });
    }

    items.push({
      icon: 'ArrowBottomOutline',
      label: 'Receive',
      onPress: () => {
        void handleReceive?.(item);
      },
    });

    return items;
  }, [swapConfig, handleSwap, handleBridge, handleReceive, item]);

  return (
    <XStack gap="$2" alignItems="center" justifyContent="flex-end">
      <Button
        size="small"
        variant="secondary"
        onPress={() => {
          onPress?.(item);
        }}
      >
        {buttonText}
      </Button>
      {needAdditionButton ? (
        <ActionList
          title=""
          renderTrigger={
            <IconButton icon="DotVerOutline" size="small" variant="tertiary" />
          }
          items={actionItems}
        />
      ) : null}
    </XStack>
  );
};

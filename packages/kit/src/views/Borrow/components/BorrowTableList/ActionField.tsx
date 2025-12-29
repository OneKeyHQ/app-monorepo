import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Button, IconButton, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useBorrowContext } from '../../BorrowProvider';
import { useSupplyActions } from '../../hooks/useSupplyActions';

import type { IAssetWithToken } from '../../hooks/useSupplyActions';

type IActionFieldProps = {
  item: IAssetWithToken;
  onPress?: (item: IAssetWithToken) => void;
  needAdditionButton?: boolean;
  buttonText: React.ReactNode;
  accountId?: string;
  walletId?: string;
  indexedAccountId?: string;
  disabled?: boolean;
};

export const ActionField = ({
  item,
  onPress,
  needAdditionButton = false,
  buttonText,
  accountId = '',
  walletId = '',
  indexedAccountId,
  disabled = false,
}: IActionFieldProps) => {
  const { market } = useBorrowContext();
  const networkId = market?.networkId || '';
  const intl = useIntl();

  const { handleSwap, handleBridge, handleReceive } = useSupplyActions({
    accountId,
    walletId,
    networkId,
    indexedAccountId,
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

  const labels = useMemo(
    () => ({
      swap: intl.formatMessage({ id: ETranslations.global_swap }),
      bridge: intl.formatMessage({ id: ETranslations.swap_page_bridge }),
      receive: intl.formatMessage({ id: ETranslations.global_receive }),
    }),
    [intl],
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
        label: labels.swap,
        onPress: () => {
          void handleSwap?.(item);
        },
      });
    }

    if (swapConfig.isSupportCrossChain) {
      items.push({
        icon: 'BridgeOutline',
        label: labels.bridge,
        onPress: () => {
          void handleBridge?.(item);
        },
      });
    }

    items.push({
      icon: 'ArrowBottomOutline',
      label: labels.receive,
      onPress: () => {
        void handleReceive?.(item);
      },
    });

    return items;
  }, [swapConfig, handleSwap, handleBridge, handleReceive, item, labels]);

  return (
    <XStack gap="$2" alignItems="center" justifyContent="flex-end">
      <Button
        size="small"
        variant="secondary"
        disabled={disabled}
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

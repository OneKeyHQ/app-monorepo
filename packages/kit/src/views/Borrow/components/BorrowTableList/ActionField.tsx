import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Button, IconButton, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useBorrowContext } from '../../BorrowProvider';
import { useSupplyActions } from '../../hooks/useSupplyActions';

import type { IAssetWithToken } from '../../hooks/useSupplyActions';

export type ISwapConfig = {
  isSupportSwap: boolean;
  isSupportCrossChain: boolean;
};

type IActionFieldProps = {
  item: IAssetWithToken;
  onPress?: (item: IAssetWithToken) => void;
  needAdditionButton?: boolean;
  buttonText: React.ReactNode;
  accountId?: string;
  walletId?: string;
  indexedAccountId?: string;
  disabled?: boolean;
  swapConfig?: ISwapConfig;
};

const defaultSwapConfig: ISwapConfig = {
  isSupportSwap: false,
  isSupportCrossChain: false,
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
  swapConfig: swapConfigProp,
}: IActionFieldProps) => {
  const { market, swapConfig: contextSwapConfig } = useBorrowContext();
  const networkId = market?.networkId || '';
  const intl = useIntl();

  // Use prop if provided, otherwise use context, fallback to default
  const swapConfig = swapConfigProp ?? contextSwapConfig ?? defaultSwapConfig;

  const { handleSwap, handleBridge, handleReceive } = useSupplyActions({
    accountId,
    walletId,
    networkId,
    indexedAccountId,
    swapConfig,
  });

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
      icon: 'SwitchHorOutline' | 'BridgeOutline' | 'ArrowBottomOutline';
      label: string;
      onPress: () => void;
    }[] = [];

    if (swapConfig.isSupportSwap || swapConfig.isSupportCrossChain) {
      items.push({
        icon: 'SwitchHorOutline',
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

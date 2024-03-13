import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListSection, IKeyOfIcons } from '@onekeyhq/components';
import {
  ActionList,
  Icon,
  SizableText,
  Toast,
  XStack,
} from '@onekeyhq/components';
import {
  networkTransactionExplorerReplaceStr,
  socketBridgeScanUrl,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapProviders,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

interface ISwapTxHistoryViewInBrowserProps {
  onViewInBrowser: (url: string) => void;
  item: ISwapTxHistory;
}
const SwapTxHistoryViewInBrowser = ({
  item,
  onViewInBrowser,
}: ISwapTxHistoryViewInBrowserProps) => {
  const intl = useIntl();
  const isSingleChainSwap = useMemo(
    () =>
      item.baseInfo.fromNetwork?.networkId ===
      item.baseInfo.toNetwork?.networkId,
    [item.baseInfo.fromNetwork?.networkId, item.baseInfo.toNetwork?.networkId],
  );
  const isSocketBridgeSwap = useMemo(
    () => item.swapInfo.provider.provider === ESwapProviders.SOCKET_BRIDGE,
    [item.swapInfo.provider.provider],
  );
  const fromTxExplorerUrl = useMemo(() => {
    const fromNetworkExplorerUrl = item.baseInfo.fromNetwork?.explorer;
    if (!fromNetworkExplorerUrl) return '';
    return fromNetworkExplorerUrl.replace(
      networkTransactionExplorerReplaceStr,
      item.txInfo.txId,
    );
  }, [item.baseInfo.fromNetwork?.explorer, item.txInfo.txId]);

  const toTxExplorerUrl = useMemo(() => {
    const toNetworkExplorerUrl = item.baseInfo.toNetwork?.explorer;
    if (!toNetworkExplorerUrl || !item.txInfo.receiverTransactionId) return '';
    return toNetworkExplorerUrl.replace(
      networkTransactionExplorerReplaceStr,
      item.txInfo.receiverTransactionId,
    );
  }, [item.baseInfo.toNetwork?.explorer, item.txInfo.receiverTransactionId]);

  const onHandleFromTxExplorer = useCallback(() => {
    if (fromTxExplorerUrl) {
      onViewInBrowser(fromTxExplorerUrl);
    } else {
      Toast.error({
        title: 'error',
        message: 'no explorer',
      });
    }
  }, [fromTxExplorerUrl, onViewInBrowser]);

  const onHandleToTxExplorer = useCallback(() => {
    if (toTxExplorerUrl) {
      onViewInBrowser(toTxExplorerUrl);
    } else {
      Toast.error({
        title: 'error',
        message: 'no transaction hash',
      });
    }
  }, [onViewInBrowser, toTxExplorerUrl]);

  const onHandleSocketBridgeTxExplorer = useCallback(() => {
    onViewInBrowser(`${socketBridgeScanUrl}${item.txInfo.txId}`);
  }, [item.txInfo.txId, onViewInBrowser]);

  const triggerViewInBrowser = useMemo(
    () => (
      <XStack
        onPress={() => {
          if (isSingleChainSwap) {
            onHandleFromTxExplorer();
          }
        }}
        space="$2"
      >
        <SizableText color="$textSubdued">
          {intl.formatMessage({ id: 'action__view_in_browser' })}
        </SizableText>
        <Icon color="$iconSubdued" name="OpenOutline" size={20} />
      </XStack>
    ),
    [intl, isSingleChainSwap, onHandleFromTxExplorer],
  );

  const sectionsData = useMemo(() => {
    let sections: IActionListSection[] = [];
    if (!isSingleChainSwap) {
      const fromData = {
        title: 'FROM',
        items: [
          {
            label: item.baseInfo.fromNetwork?.name ?? '-',
            icon: 'PlaceholderOutline' as IKeyOfIcons,
            onPress: () => {
              onHandleFromTxExplorer();
            },
          },
        ],
      };
      const toData = {
        title: 'TO',
        items: [
          {
            label: item.baseInfo.toNetwork?.name ?? '-',
            icon: 'PlaceholderOutline' as IKeyOfIcons,
            onPress: () => {
              onHandleToTxExplorer();
            },
          },
        ],
      };
      sections = [fromData, toData];
    }
    if (isSocketBridgeSwap) {
      const socketBridgeItemData = {
        title: 'Provider',
        items: [
          {
            label: item.swapInfo.provider.providerName,
            icon: 'PlaceholderOutline' as IKeyOfIcons,
            onPress: () => {
              onHandleSocketBridgeTxExplorer();
            },
          },
        ],
      };
      sections = [socketBridgeItemData, ...sections];
    }
    return sections;
  }, [
    isSingleChainSwap,
    isSocketBridgeSwap,
    item.baseInfo.fromNetwork?.name,
    item.baseInfo.toNetwork?.name,
    item.swapInfo.provider.providerName,
    onHandleFromTxExplorer,
    onHandleSocketBridgeTxExplorer,
    onHandleToTxExplorer,
  ]);
  if (isSingleChainSwap) {
    return triggerViewInBrowser;
  }
  return (
    <ActionList
      sections={sectionsData}
      title={intl.formatMessage({ id: 'action__view_in_browser' })}
      renderTrigger={triggerViewInBrowser}
    />
  );
};

export default SwapTxHistoryViewInBrowser;

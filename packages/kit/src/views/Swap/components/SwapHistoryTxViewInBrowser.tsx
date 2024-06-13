import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Divider,
  Icon,
  Image,
  ListView,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { networkTransactionExplorerReplaceStr } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapTxHistoryStatus,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

interface ISwapTxHistoryViewInBrowserProps {
  onViewInBrowser: (url: string) => void;
  item: ISwapTxHistory;
}

enum EExplorerType {
  PROVIDER = 'provider',
  FROM = 'from',
  TO = 'to',
}

interface IExplorersInfo {
  url?: string;
  logo?: string;
  status: ESwapTxHistoryStatus;
  type: EExplorerType;
  name: string;
}

const ExplorersList = ({
  data,
  onPressItem,
}: {
  data: IExplorersInfo[];
  onPressItem: (item: IExplorersInfo) => void;
}) => {
  const intl = useIntl();
  const parserLabel = useCallback(
    (type: EExplorerType) => {
      switch (type) {
        case EExplorerType.FROM:
          return intl.formatMessage({
            id: ETranslations.swap_history_detail_from,
          });
        case EExplorerType.TO:
          return intl.formatMessage({
            id: ETranslations.swap_history_detail_to,
          });
        case EExplorerType.PROVIDER:
          return intl.formatMessage({
            id: ETranslations.swap_history_detail_provider,
          });
        default:
          return '';
      }
    },
    [intl],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: IExplorersInfo; index: number }) => (
      <YStack
        space="$4"
        px="$5"
        pb="$5"
        {...(!item.url && {
          opacity: 0.5,
        })}
        onPress={() => {
          if (item.url) {
            onPressItem(item);
          }
        }}
      >
        <SizableText size="$headingSm">{parserLabel(item.type)}</SizableText>
        <XStack justifyContent="space-between">
          <XStack space="$2">
            <Image height="$6" width="$6" borderRadius="$full">
              <Image.Source
                source={{
                  uri: item.logo,
                }}
              />
              <Image.Fallback
                alignItems="center"
                justifyContent="center"
                bg="$bgStrong"
                delayMs={1000}
              >
                <Icon size="$5" name="CoinOutline" color="$iconDisabled" />
              </Image.Fallback>
            </Image>
            <SizableText size="$bodyLg">{item.name}</SizableText>
          </XStack>
          {item.status === ESwapTxHistoryStatus.PENDING &&
          item.type === EExplorerType.TO ? (
            <Badge badgeType="info" badgeSize="lg">
              {intl.formatMessage({
                id: ETranslations.swap_history_detail_status_pending,
              })}
            </Badge>
          ) : null}
        </XStack>
        {!(index === data.length - 1) ? <Divider /> : null}
      </YStack>
    ),
    [data.length, intl, onPressItem, parserLabel],
  );
  return (
    <ListView
      pt="$5"
      estimatedItemSize="$10"
      data={data}
      renderItem={renderItem}
    />
  );
};

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
    () => !!item.swapInfo.socketBridgeScanUrl,
    [item.swapInfo.socketBridgeScanUrl],
  );
  const fromTxExplorer = useMemo(() => {
    const logo = item.baseInfo.fromNetwork?.logoURI;
    const transactionExplorer =
      item.baseInfo.fromNetwork?.explorers?.[0]?.transaction;
    const url = transactionExplorer?.replace(
      networkTransactionExplorerReplaceStr,
      item.txInfo.txId,
    );
    return {
      name: item.baseInfo.fromNetwork?.name ?? '-',
      url,
      logo,
      status: item.status,
      type: EExplorerType.FROM,
    };
  }, [
    item.baseInfo.fromNetwork?.explorers,
    item.baseInfo.fromNetwork?.logoURI,
    item.baseInfo.fromNetwork?.name,
    item.status,
    item.txInfo.txId,
  ]);

  const toTxExplorer = useMemo(() => {
    const logo = item.baseInfo.toNetwork?.logoURI;
    const transactionExplorer =
      item.baseInfo.toNetwork?.explorers?.[0]?.transaction;
    let url = '';
    if (
      item.txInfo.receiverTransactionId &&
      transactionExplorer &&
      item.status === ESwapTxHistoryStatus.SUCCESS
    ) {
      url = transactionExplorer?.replace(
        networkTransactionExplorerReplaceStr,
        item.txInfo.receiverTransactionId,
      );
    }
    return {
      name: item.baseInfo.toNetwork?.name ?? '-',
      url,
      logo,
      status: item.status,
      type: EExplorerType.TO,
    };
  }, [
    item.baseInfo.toNetwork?.explorers,
    item.baseInfo.toNetwork?.logoURI,
    item.baseInfo.toNetwork?.name,
    item.status,
    item.txInfo.receiverTransactionId,
  ]);

  const providerExplorer = useMemo(() => {
    const logo = item.swapInfo.provider?.providerLogo;
    const url = item.swapInfo.socketBridgeScanUrl
      ? `${item.swapInfo.socketBridgeScanUrl}${item.txInfo.txId}`
      : undefined;
    return {
      name: item.swapInfo.provider.providerName,
      url,
      logo,
      status: item.status,
      type: EExplorerType.PROVIDER,
    };
  }, [
    item.status,
    item.swapInfo.provider?.providerLogo,
    item.swapInfo.provider.providerName,
    item.swapInfo.socketBridgeScanUrl,
    item.txInfo.txId,
  ]);

  const onHandleExplorer = useCallback(
    (t: IExplorersInfo) => {
      if (t.url) {
        onViewInBrowser(t.url);
      }
    },
    [onViewInBrowser],
  );

  const explorersData = useMemo(() => {
    let data = [fromTxExplorer, toTxExplorer];
    if (isSocketBridgeSwap) {
      data = [providerExplorer, ...data];
    }
    return data;
  }, [fromTxExplorer, isSocketBridgeSwap, providerExplorer, toTxExplorer]);

  const triggerViewInBrowser = useMemo(
    () => (
      <XStack
        onPress={() => {
          if (isSingleChainSwap) {
            onHandleExplorer(fromTxExplorer);
          }
        }}
        space="$2"
      >
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.swap_history_detail_view_in_browser,
          })}
        </SizableText>
        <Icon color="$iconSubdued" name="OpenOutline" size={20} />
      </XStack>
    ),
    [fromTxExplorer, intl, isSingleChainSwap, onHandleExplorer],
  );
  if (isSingleChainSwap) {
    return triggerViewInBrowser;
  }
  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.swap_history_detail_view_in_browser,
      })}
      renderTrigger={triggerViewInBrowser}
      renderContent={
        <ExplorersList data={explorersData} onPressItem={onHandleExplorer} />
      }
    />
  );
};

export default SwapTxHistoryViewInBrowser;

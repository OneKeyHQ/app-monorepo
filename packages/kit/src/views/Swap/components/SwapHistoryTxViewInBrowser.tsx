import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
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
import {
  ESwapTxHistoryStatus,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

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
  data: IExplorersInfo[] | undefined;
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
        gap="$4"
        px="$5"
        pb="$5"
        cursor="pointer"
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
          <XStack gap="$2">
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
          {(item.status === ESwapTxHistoryStatus.PENDING ||
            item.status === ESwapTxHistoryStatus.CANCELING) &&
          item.type === EExplorerType.TO ? (
            <Badge badgeType="info" badgeSize="lg">
              {intl.formatMessage({
                id: ETranslations.swap_history_detail_status_pending,
              })}
            </Badge>
          ) : null}
        </XStack>
        {!(data?.length && index === data.length - 1) ? <Divider /> : null}
      </YStack>
    ),
    [data?.length, intl, onPressItem, parserLabel],
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
  const fromTxExplorer = useCallback(async () => {
    const logo = item.baseInfo.fromNetwork?.logoURI;
    let url = '';
    if (item.baseInfo.fromNetwork?.networkId) {
      url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl({
        networkId: item.baseInfo.fromNetwork?.networkId,
        type: 'transaction',
        param: item.txInfo.txId,
      });
    }
    return {
      name: item.baseInfo.fromNetwork?.name ?? '-',
      url,
      logo,
      status: item.status,
      type: EExplorerType.FROM,
    };
  }, [
    item.baseInfo.fromNetwork?.logoURI,
    item.baseInfo.fromNetwork?.name,
    item.baseInfo.fromNetwork?.networkId,
    item.status,
    item.txInfo.txId,
  ]);

  const toTxExplorer = useCallback(async () => {
    const logo = item.baseInfo.toNetwork?.logoURI;
    let url = '';
    if (
      item.txInfo.receiverTransactionId &&
      item.baseInfo.toNetwork?.networkId &&
      item.status === ESwapTxHistoryStatus.SUCCESS
    ) {
      url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl({
        networkId: item.baseInfo.toNetwork?.networkId,
        type: 'transaction',
        param: item.txInfo.receiverTransactionId,
      });
    }
    return {
      name: item.baseInfo.toNetwork?.name ?? '-',
      url,
      logo,
      status: item.status,
      type: EExplorerType.TO,
    };
  }, [
    item.baseInfo.toNetwork?.logoURI,
    item.baseInfo.toNetwork?.name,
    item.baseInfo.toNetwork?.networkId,
    item.status,
    item.txInfo.receiverTransactionId,
  ]);

  const providerExplorer = useMemo(() => {
    const logo = item.swapInfo.provider?.providerLogo;
    const url = item.swapInfo.socketBridgeScanUrl
      ? `${item.swapInfo.socketBridgeScanUrl}${item.txInfo.txId}`
      : '';
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

  const explorersDataCall = useCallback(async () => {
    let data = [await fromTxExplorer(), await toTxExplorer()];
    if (isSocketBridgeSwap) {
      data = [providerExplorer, ...data];
    }
    return data;
  }, [fromTxExplorer, isSocketBridgeSwap, providerExplorer, toTxExplorer]);

  const explorersData = usePromiseResult(
    explorersDataCall,
    [explorersDataCall],
    {},
  );

  const triggerViewInBrowser = useMemo(
    () => (
      <Button
        onPress={async () => {
          if (isSingleChainSwap) {
            onHandleExplorer(await fromTxExplorer());
          }
        }}
        size="small"
        variant="secondary"
        iconAfter="OpenOutline"
        iconColor="$iconSubdued"
      >
        {intl.formatMessage({
          id: ETranslations.swap_history_detail_view_in_browser,
        })}
      </Button>
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
        <ExplorersList
          data={explorersData.result}
          onPressItem={onHandleExplorer}
        />
      }
    />
  );
};

export default SwapTxHistoryViewInBrowser;

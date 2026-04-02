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
import {
  ChainFlipLogo,
  ChainFlipName,
  EExplorerType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IExplorersInfo,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

interface ISwapTxHistoryViewInBrowserProps {
  onViewInBrowser: (url: string) => void;
  item: ISwapTxHistory;
  fromTxExplorer: () => Promise<IExplorersInfo>;
  toTxExplorer: () => Promise<IExplorersInfo>;
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
            <Image
              size="$6"
              borderRadius="$full"
              source={{ uri: item.logo }}
              fallback={
                <Image.Fallback
                  w="$6"
                  h="$6"
                  alignItems="center"
                  justifyContent="center"
                  bg="$bgStrong"
                >
                  <Icon size="$5" name="CoinOutline" color="$iconDisabled" />
                </Image.Fallback>
              }
            />

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
  fromTxExplorer,
  toTxExplorer,
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

  const isChainFlipSwap = useMemo(
    () => !!item.swapInfo.chainFlipExplorerUrl,
    [item.swapInfo.chainFlipExplorerUrl],
  );

  const providerExplorer = useMemo(() => {
    let logo = item.swapInfo.provider?.providerLogo;
    let name = item.swapInfo.provider.providerName;
    let url =
      item.swapInfo.socketBridgeScanUrl && item.txInfo.txId
        ? `${item.swapInfo.socketBridgeScanUrl}${item.txInfo.txId}`
        : '';
    if (isChainFlipSwap) {
      url = item.swapInfo.chainFlipExplorerUrl ?? '';
      name = ChainFlipName;
      logo = ChainFlipLogo;
    }
    return {
      name,
      url,
      logo,
      status: item.status,
      type: EExplorerType.PROVIDER,
    };
  }, [
    isChainFlipSwap,
    item.status,
    item.swapInfo.chainFlipExplorerUrl,
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
    if (isSocketBridgeSwap || isChainFlipSwap) {
      data = [providerExplorer, ...data];
    }
    return data;
  }, [
    fromTxExplorer,
    isSocketBridgeSwap,
    isChainFlipSwap,
    providerExplorer,
    toTxExplorer,
  ]);

  const explorersData = usePromiseResult(
    explorersDataCall,
    [explorersDataCall],
    {},
  );

  const triggerViewInBrowser = useMemo(
    () => (
      <XStack
        onPress={async () => {
          if (isSingleChainSwap) {
            onHandleExplorer(await fromTxExplorer());
          }
        }}
        cursor="pointer"
        alignItems="center"
        justifyContent="center"
      >
        <Icon
          name="OpenOutline"
          size="$4.5"
          flex={1}
          alignSelf="center"
          color="$iconSubdued"
        />
      </XStack>
    ),
    [fromTxExplorer, isSingleChainSwap, onHandleExplorer],
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

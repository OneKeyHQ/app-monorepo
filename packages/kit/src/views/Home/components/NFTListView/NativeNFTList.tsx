import { useCallback, useMemo, useState } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import BigNumber from 'bignumber.js';

import {
  useMedia,
  useScrollContentTabBarOffset,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EmptyNFT, EmptySearch } from '@onekeyhq/kit/src/components/Empty';
import { NFTListLoadingView } from '@onekeyhq/kit/src/components/Loading';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSearchKeyAtom } from '@onekeyhq/kit/src/states/jotai/contexts/nftList';
import { SHOW_NFT_AMOUNT_MAX } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import {
  getFilteredNftsBySearchKey,
  getNFTMediaProbeOrder,
} from '@onekeyhq/shared/src/utils/nftUtils';
import { ENFTType, type IAccountNFT } from '@onekeyhq/shared/types/nft';

import { useHomeNativeListTheme } from '../../hooks/useHomeNativeListTheme';
import { useHomeNativeRefresh } from '../../hooks/useHomeNativeRefresh';
import { prepareHomeNativeListSnapshot } from '../homeNativeListSnapshot';

import { buildNativeNFTRowsByKey } from './nativeNFTRows';

import type {
  NativeListSnapshot,
  RowActionEvent,
} from '@onekeyfe/react-native-native-list';
import type { LayoutChangeEvent } from 'react-native';

type IProps = {
  data: IAccountNFT[];
  isLoading?: boolean;
  initialized?: boolean;
  onRefresh?: () => void;
  isAllNetworks?: boolean;
  webScrollHost?: HTMLElement | null;
  webContentWidth?: number;
  webContentPadding?: {
    horizontal: number;
    top: number;
    bottom: number;
  };
};

export function NFTListView({
  data,
  isLoading,
  initialized,
  onRefresh: refresh,
  isAllNetworks,
  webScrollHost,
  webContentWidth,
  webContentPadding,
}: IProps) {
  const [searchKey] = useSearchKeyAtom();
  const navigation = useAppNavigation();
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const media = useMedia();
  const numColumns = useMemo(() => {
    if (media.gt2xl) return 7;
    if (media.gtXl) return 6;
    if (media.gtLg) return 4;
    if (media.gtSm) return 3;
    return 2;
  }, [media.gt2xl, media.gtXl, media.gtLg, media.gtSm]);
  const bottom = useScrollContentTabBarOffset();
  const { refreshing, onRefresh } = useHomeNativeRefresh(refresh);
  const nativeListTheme = useHomeNativeListTheme();
  const componentTheme = useTheme();
  const theme = useMemo(
    () =>
      webScrollHost === undefined
        ? nativeListTheme
        : {
            ...nativeListTheme,
            disabledText: componentTheme.iconDisabled.val,
            accent: componentTheme.focusRing.val,
          },
    [nativeListTheme, componentTheme, webScrollHost],
  );
  const filteredNfts = useMemo(
    () => getFilteredNftsBySearchKey({ nfts: data, searchKey }),
    [data, searchKey],
  );
  const networkIds = useMemo(
    () => [
      ...new Set(
        filteredNfts
          .map((nft) => nft.networkId ?? network?.id)
          .filter((id): id is string => !!id),
      ),
    ],
    [filteredNfts, network?.id],
  );
  const networkRequestIdentity = JSON.stringify(networkIds.toSorted());
  const { result: networks } = usePromiseResult(async () => {
    const results = await Promise.allSettled(
      (JSON.parse(networkRequestIdentity) as string[]).map(
        async (networkId) =>
          [
            networkId,
            await backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
          ] as const,
      ),
    );
    return Object.fromEntries(
      results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      ),
    );
  }, [networkRequestIdentity]);
  const identity = `${account?.id ?? ''}:${network?.id ?? ''}`;
  const itemsByKey = useMemo(
    () => buildNativeNFTRowsByKey(filteredNfts, account?.id, network?.id),
    [filteredNfts, account?.id, network?.id],
  );
  const [webLayoutWidth, setWebLayoutWidth] = useState(0);
  const handleWebLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setWebLayoutWidth((previous) => (previous === width ? previous : width));
  }, []);
  const measuredContentWidth = webLayoutWidth || webContentWidth;
  const webRowHeight =
    measuredContentWidth && webScrollHost !== undefined
      ? (measuredContentWidth - 2 * (webContentPadding?.horizontal ?? 10)) /
          numColumns +
        60
      : undefined;
  const contentPaddingBottom = useMemo(() => {
    if (!webContentPadding) return bottom ?? 24;
    if (!itemsByKey.size) return webContentPadding.bottom;
    // Preserve the old Web measured-content padding and complete-row clearance.
    const trailingRowHeight =
      itemsByKey.size % numColumns === 0 ? (webRowHeight ?? 0) : 0;
    return webContentPadding.bottom * 2 + trailingRowHeight;
  }, [webContentPadding, bottom, itemsByKey.size, numColumns, webRowHeight]);
  const handlePress = useCallback(
    (nft: IAccountNFT) => {
      if (!account || !network || !wallet) return;
      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.NFTDetails,
        params: {
          networkId: nft.networkId ?? network.id,
          accountId: nft.accountId ?? account.id,
          walletId: wallet.id,
          collectionAddress: nft.collectionAddress,
          itemId: nft.itemId,
        },
      });
    },
    [account, network, wallet, navigation],
  );
  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      const nft = event.rowKey ? itemsByKey.get(event.rowKey) : undefined;
      if (nft && event.actionKey === 'press') handlePress(nft);
    },
    [itemsByKey, handlePress],
  );
  const snapshot = useMemo<NativeListSnapshot>(
    () => ({
      schemaVersion: 1,
      generation: 1,
      layout: {
        kind: 'grid',
        gridColumns: numColumns,
        contentPaddingHorizontal: webContentPadding?.horizontal ?? 10,
        contentPaddingTop: webContentPadding?.top ?? 12,
        contentPaddingBottom,
      },
      theme,
      capabilities: {
        pullToRefresh: true,
        refreshing,
        refreshTriggerDistance: 65,
      },
      rows: [...itemsByKey.entries()].map(([key, nft]) => {
        const uri = nft.metadata?.image;
        const probeOrder = getNFTMediaProbeOrder(uri);
        const logo = networks?.[nft.networkId ?? network?.id ?? '']?.logoURI;
        const quantity = new BigNumber(nft.amount ?? 1);
        return {
          key,
          type: 'mediaTile',
          height: webRowHeight,
          variant: 'gallery',
          title: nft.metadata?.name || '-',
          subtitle: nft.collectionName || '-',
          ...(uri && probeOrder.length
            ? {
                media: {
                  source: { uri, width: 160, height: 160 },
                  probeOrder,
                },
              }
            : { imageState: 'error' }),
          networkImage:
            isAllNetworks && logo
              ? { uri: logo, width: 14, height: 14 }
              : undefined,
          badge:
            nft.collectionType === ENFTType.ERC1155 && quantity.gt(1)
              ? {
                  key: 'quantity',
                  text: `x${quantity.gt(SHOW_NFT_AMOUNT_MAX) ? `${SHOW_NFT_AMOUNT_MAX}+` : nft.amount}`,
                }
              : undefined,
          style: {
            horizontalPadding: 10,
            verticalPadding: 10,
            title: { fontSize: 16, fontWeight: 'medium', lineHeight: 24 },
            subtitle: { fontSize: 12, lineHeight: 16 },
          },
        };
      }),
    }),
    [
      numColumns,
      contentPaddingBottom,
      webContentPadding,
      webRowHeight,
      theme,
      refreshing,
      itemsByKey,
      networks,
      network?.id,
      isAllNetworks,
    ],
  );
  const preparedSnapshot = useMemo(
    () => prepareHomeNativeListSnapshot(snapshot),
    [snapshot],
  );
  const empty = useMemo(() => {
    if (!initialized && isLoading) return <NFTListLoadingView />;
    if (searchKey) return <EmptySearch flex={1} />;
    return <EmptyNFT />;
  }, [initialized, isLoading, searchKey]);

  return (
    <NativeList
      key={identity}
      testID="home-nft-list"
      onLayout={webScrollHost === undefined ? undefined : handleWebLayout}
      style={
        webScrollHost === undefined
          ? { flex: 1 }
          : {
              flexGrow: 0,
              flexShrink: 0,
              // Match the legacy empty list's extent without moving its content.
              marginBottom: itemsByKey.size
                ? 0
                : -(webContentPadding?.top ?? 12),
            }
      }
      snapshot={preparedSnapshot}
      webScrollHost={webScrollHost}
      listEmpty={empty}
      onRefresh={onRefresh}
      onRowAction={handleRowAction}
    />
  );
}

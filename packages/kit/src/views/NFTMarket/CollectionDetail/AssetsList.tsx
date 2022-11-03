import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ListRenderItem } from 'react-native';

import {
  Box,
  FlatList,
  Text,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { MAX_PAGE_CONTAINER_WIDTH } from '../../../config';
import { useIsMounted } from '../../../hooks/useIsMounted';
import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';
import { useGridListLayout } from '../../Wallet/NFT/SendNFTList';

import { useCollectionDetailContext } from './context';

const AssetsList = ({
  contractAddress,
  networkId,
}: {
  contractAddress: string;
  networkId: string;
}) => {
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const isMounted = useIsMounted();

  const [listData, updateListData] = useState<NFTAsset[]>([]);
  const context = useCollectionDetailContext()?.context;
  const setContext = useCollectionDetailContext()?.setContext;
  const cursor = useRef<string | undefined>();
  const { serviceNFT } = backgroundApiProxy;

  const marginBottom = isSmallScreen ? 16 : 24;
  const margin = isSmallScreen ? 8 : 24;
  const pageWidth = isSmallScreen
    ? screenWidth - 16 * 2
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224) - 51 * 2;

  const { cardWidth, numColumns } = useGridListLayout({
    maxCardWidth: 145,
    numColumns: 3,
    margin,
    pageWidth,
  });

  const getData = useCallback(
    async (param: {
      chain: string;
      contractAddress: string;
      cursor?: string;
    }) => {
      const data = await serviceNFT.getCollectionAssets(param);
      if (data?.content) {
        cursor.current = data.next;
        updateListData((prev) => {
          if (context?.refreshing) {
            return data.content;
          }
          return prev.concat(data?.content);
        });
      }
    },
    [context?.refreshing, serviceNFT],
  );
  useEffect(() => {
    (() => {
      if (context?.selectedIndex === 0 && isMounted) {
        if (context?.refreshing) {
          cursor.current = undefined;
        }
        getData({
          chain: networkId,
          contractAddress,
          cursor: cursor.current,
        }).then(() => {
          if (setContext) {
            setContext((ctx) => ({ ...ctx, refreshing: false }));
          }
        });
      }
    })();
  }, [
    context?.refreshing,
    context?.selectedIndex,
    contractAddress,
    getData,
    isMounted,
    networkId,
    setContext,
  ]);

  const renderItem: ListRenderItem<NFTAsset> = useCallback(
    ({ item }) => {
      let name = '';
      if (item.name && item.name.length > 0) {
        name = item.name;
      } else {
        name = `#${item.tokenId as string}`;
      }

      return (
        <Box
          flexDirection="column"
          height={cardWidth + 52}
          width={cardWidth}
          marginRight={`${margin}px`}
          marginBottom={`${marginBottom}px`}
        >
          <NFTListImage asset={item} borderRadius="6px" size={cardWidth} />
          <Text typography="Body2Strong" mt="8px" numberOfLines={1}>
            {name}
          </Text>
          {item.latestTradePrice && (
            <Text
              typography="Body2"
              mt="4px"
              color="text-subdued"
              numberOfLines={1}
            >
              {`${item.latestTradePrice} ${item.latestTradeSymbol as string}`}
            </Text>
          )}
        </Box>
      );
    },
    [cardWidth, margin, marginBottom],
  );

  const paddingX = isSmallScreen ? 16 : 0;
  return (
    <FlatList<NFTAsset>
      contentContainerStyle={{ paddingLeft: paddingX, paddingRight: paddingX }}
      key={numColumns}
      numColumns={numColumns}
      ListHeaderComponent={() => (
        <Box height={isSmallScreen ? '24px' : '32px'} />
      )}
      // ListFooterComponent={() => <Box height="44px" bgColor="amber.400" />}
      data={listData}
      renderItem={renderItem}
      keyExtractor={(item: NFTAsset) => `${item.tokenId as string}`}
      onEndReached={() => {
        getData({
          chain: networkId,
          contractAddress,
          cursor: cursor.current,
        });
      }}
    />
  );
};

export default AssetsList;

import React, { FC, useCallback, useEffect, useRef } from 'react';

import { useNavigation } from '@react-navigation/native';
import { Column, Row } from 'native-base';
import { ListRenderItem, TouchableOpacity } from 'react-native';

import {
  Box,
  CustomSkeleton,
  Skeleton,
  Text,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { NFTAsset } from '@onekeyhq/engine/src/types/nft';
import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Collectibles';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useRuntime } from '../../../hooks/redux';
import { useIsMounted } from '../../../hooks/useIsMounted';
import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';
import { useGridListLayout } from '../../Wallet/NFT/SendNFTList';

import { useCollectionDetailContext } from './context';
import { ListProps } from './type';

export function getRequestLimit(numberColumn: number) {
  switch (numberColumn) {
    case 3:
      return 45;
    case 4:
      return 48;
    default:
      return 50;
  }
}
type FooterProps = {
  margin: number;
  cardWidth: number;
  numColumns: number;
  marginBottom: number;
};

const MAX_PAGE_CONTAINER_WIDTH = 992;

const Footer: FC<FooterProps> = ({
  numColumns,
  margin,
  cardWidth,
  marginBottom,
}) => {
  const numRows = 2;

  const rowArray = new Array(numRows).fill(0);
  const colArray = new Array(numColumns).fill(0);
  const isSmallScreen = useIsVerticalLayout();
  return (
    <Column width="full" space={`${marginBottom}px`}>
      {rowArray.map((col, rowIndex) => (
        <Row key={`col${rowIndex}`} width="full" space={`${margin}px`}>
          {colArray.map((row, colIndex) => (
            <Box key={`row${colIndex}${rowIndex}`} flexDirection="column">
              <CustomSkeleton
                width={cardWidth}
                height={cardWidth}
                borderRadius="12px"
              />
              <Box mt="8px">
                <Skeleton shape={isSmallScreen ? 'Body2' : 'Body1'} />
              </Box>
            </Box>
          ))}
        </Row>
      ))}
    </Column>
  );
};
type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

export const AssetListCell: FC<{
  onPress: () => void;
  asset: NFTAsset;
  cardWidth: number;
  margin?: number;
  marginBottom?: number;
}> = ({ asset, cardWidth, margin, marginBottom, ...props }) => {
  let name = '';
  if (asset.name && asset.name.length > 0) {
    name = asset.name;
  } else {
    name = `#${asset.tokenId as string}`;
  }
  let price = '';
  if (asset.latestTradePrice && typeof asset.latestTradePrice === 'number') {
    price = `${asset.latestTradePrice} ${asset.latestTradeSymbol as string}`;
  }
  const { onPress } = props;
  const isSmallScreen = useIsVerticalLayout();

  return (
    <>
      <TouchableOpacity
        style={{
          marginHorizontal: isSmallScreen ? 4 : 12,
          width: cardWidth,
        }}
        onPress={onPress}
      >
        <NFTListImage asset={asset} borderRadius="12px" size={cardWidth} />
        <Box mt="8px" alignSelf="stretch">
          <Text
            typography={{ sm: 'Body2Strong', md: 'Body1Strong' }}
            isTruncated
          >
            {name}
          </Text>
          {price ? (
            <Text
              typography="Body2"
              mt="4px"
              color="text-subdued"
              numberOfLines={1}
            >
              {price}
            </Text>
          ) : null}
        </Box>
      </TouchableOpacity>
    </>
  );
};
const AssetsList = ({
  contractAddress,
  networkId,
  ListHeaderComponent,
}: ListProps) => {
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const isMounted = useIsMounted();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const context = useCollectionDetailContext()?.context;
  const setContext = useCollectionDetailContext()?.setContext;
  const cursor = useRef<string | undefined>();
  const { serviceNFT } = backgroundApiProxy;

  const padding = isSmallScreen ? 16 : 32;
  const marginBottom = isSmallScreen ? 16 : 24;
  const margin = isSmallScreen ? 8 : 24;
  const pageWidth = isSmallScreen
    ? screenWidth - 16 * 2
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224 - padding * 2);

  console.log('pageWidth = ', pageWidth);

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
      limit?: number;
    }) => {
      const data = await serviceNFT.getCollectionAssets(param);
      if (data?.content) {
        cursor.current = data.next;
        if (setContext) {
          setContext((ctx) => {
            if (context?.refreshing) {
              return { ...ctx, assetList: data.content };
            }
            return { ...ctx, assetList: ctx.assetList.concat(data?.content) };
          });
        }
      }
    },
    [context?.refreshing, serviceNFT, setContext],
  );

  useEffect(() => {
    (() => {
      if (context?.selectedIndex === 0 && isMounted) {
        if (context?.refreshing) {
          cursor.current = undefined;
        }
        if (cursor.current !== null) {
          getData({
            chain: networkId,
            contractAddress,
            cursor: cursor.current,
            limit: getRequestLimit(numColumns),
          }).then(() => {
            if (setContext) {
              setContext((ctx) => ({ ...ctx, refreshing: false }));
            }
          });
        }
      }
    })();
  }, [
    context?.refreshing,
    context?.selectedIndex,
    contractAddress,
    getData,
    isMounted,
    networkId,
    numColumns,
    setContext,
  ]);
  const { networks } = useRuntime();

  const network = networks.find((item) => item.id === networkId);

  const handleSelectAsset = useCallback(
    (asset: NFTAsset) => {
      if (!network) return;
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.NFTDetailModal,
          params: {
            asset,
            network,
            isOwner: false,
          },
        },
      });
    },
    [navigation, network],
  );

  const renderItem: ListRenderItem<NFTAsset> = useCallback(
    ({ item }) => (
      <AssetListCell
        onPress={() => {
          handleSelectAsset(item);
        }}
        asset={item}
        cardWidth={cardWidth}
      />
    ),
    [cardWidth, handleSelectAsset],
  );

  return (
    <Tabs.FlatList
      key={numColumns}
      numColumns={numColumns}
      ListHeaderComponent={ListHeaderComponent}
      style={{
        padding,
      }}
      contentContainerStyle={{
        width: '100%',
        maxWidth: MAX_PAGE_CONTAINER_WIDTH,
        alignSelf: 'center',
      }}
      columnWrapperStyle={{
        marginHorizontal: isSmallScreen ? -4 : -12,
        paddingBottom: isSmallScreen ? 16 : 24,
      }}
      ListFooterComponent={() => {
        if (cursor.current !== null) {
          return (
            <Footer
              numColumns={numColumns}
              cardWidth={cardWidth}
              margin={margin}
              marginBottom={marginBottom}
            />
          );
        }
        return <Box />;
      }}
      data={context?.assetList}
      renderItem={renderItem}
      keyExtractor={(item: NFTAsset) => `${item.tokenId as string}`}
      onEndReached={() => {
        if (cursor.current !== null) {
          getData({
            chain: networkId,
            contractAddress,
            cursor: cursor.current,
            limit: getRequestLimit(numColumns),
          });
        }
      }}
    />
  );
};

export default AssetsList;

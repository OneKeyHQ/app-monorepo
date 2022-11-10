import React, { FC, useCallback, useEffect, useRef } from 'react';

import { useNavigation } from '@react-navigation/native';
import { Column, Row } from 'native-base';
import { ListRenderItem } from 'react-native';

import {
  Box,
  CustomSkeleton,
  Pressable,
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
import { MAX_PAGE_CONTAINER_WIDTH } from '../../../config';
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
const Footer: FC<FooterProps> = ({
  numColumns,
  margin,
  cardWidth,
  marginBottom,
}) => {
  const numRows = 4;

  const rowArray = new Array(numRows).fill(0);
  const colArray = new Array(numColumns).fill(0);
  return (
    <Column width="full" space={`${marginBottom}px`} paddingBottom="16px">
      {rowArray.map((col, rowIndex) => (
        <Row
          key={`col${rowIndex}`}
          width="full"
          space={`${margin}px`}
          marginBottom="20px"
        >
          {colArray.map((row, colIndex) => (
            <Box key={`row${colIndex}${rowIndex}`} flexDirection="column">
              <CustomSkeleton
                width={cardWidth}
                height={cardWidth}
                borderRadius="12px"
              />
              <CustomSkeleton
                mt="8px"
                width="50px"
                height="10px"
                borderRadius="5px"
              />
              <CustomSkeleton
                mt="4px"
                width="70px"
                height="10px"
                borderRadius="5px"
              />
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
  margin: number;
  marginBottom: number;
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
  return (
    <Pressable
      onPress={onPress}
      flexDirection="column"
      height={cardWidth + 52}
      width={cardWidth}
      marginRight={`${margin}px`}
      marginBottom={`${marginBottom}px`}
    >
      <NFTListImage asset={asset} borderRadius="6px" size={cardWidth} />
      <Text typography="Body2Strong" mt="8px" numberOfLines={1}>
        {name}
      </Text>
      <Text typography="Body2" mt="4px" color="text-subdued" numberOfLines={1}>
        {price}
      </Text>
    </Pressable>
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
        margin={margin}
        marginBottom={marginBottom}
      />
    ),
    [cardWidth, handleSelectAsset, margin, marginBottom],
  );

  const paddingX = isSmallScreen ? 16 : 51;
  return (
    <Tabs.FlatList
      contentContainerStyle={{ paddingLeft: paddingX, paddingRight: paddingX }}
      key={numColumns}
      numColumns={numColumns}
      ListHeaderComponent={
        ListHeaderComponent ?? <Box height={isSmallScreen ? '24px' : '32px'} />
      }
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

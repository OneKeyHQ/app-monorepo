import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';

import {
  Box,
  Modal,
  NetImage,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import RecyclerListView, {
  DataProvider,
  LayoutProvider,
} from '@onekeyhq/components/src/RecyclerListView';
import type { Collection, NFTAsset } from '@onekeyhq/engine/src/types/nft';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import { CollectiblesModalRoutes } from '../../../routes/routesEnum';

import NFTListAssetCard from './NFTList/NFTListAssetCard';

import type { CollectiblesRoutesParams } from '../../../routes/Root/Modal/Collectibles';
import type { RouteProp } from '@react-navigation/native';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

const ViewTypes = {
  LOGO: 0,
  NAME: 1,
  DESC: 2,
  NFTCard: 3,
  Other: 4,
};

type ListDataType = {
  viewType: number;
  data?: string | NFTAsset | null;
}[];

function generateListArray(originData: Collection): ListDataType {
  let result: ListDataType = [];
  if (originData?.logoUrl && originData?.logoUrl.length > 0) {
    result.push({
      viewType: ViewTypes.LOGO,
      data: originData.logoUrl,
    });
  }

  result.push({
    viewType: ViewTypes.NAME,
    data: originData.contractName,
  });
  result = result.concat(
    originData.assets.map((item) => ({
      viewType: ViewTypes.NFTCard,
      data: item,
    })),
  );
  // }
  return result;
}

type CollectionModalProps = {
  onSelectAsset: (asset: NFTAsset) => void;
};

const CollectionModal: FC<CollectionModalProps> = () => {
  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { screenWidth } = useUserDevice();
  const margin = isSmallScreen ? 16 : 20;
  const padding = 16;
  const pageWidth = isSmallScreen ? screenWidth : 800;

  const cardWidth = isSmallScreen
    ? Math.floor((pageWidth - padding * 2 - margin) / 2)
    : 177;

  const cardInnerPadding = isSmallScreen ? 8 : 12;
  const imageWidth = cardWidth - 2 * cardInnerPadding;
  const cardHeight = imageWidth + cardInnerPadding + 56;

  const route =
    useRoute<
      RouteProp<
        CollectiblesRoutesParams,
        CollectiblesModalRoutes.CollectionModal
      >
    >();
  const { collectible, network } = route.params;

  // Open Asset detail modal
  const handleSelectAsset = useCallback(
    (asset: NFTAsset) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.NFTDetailModal,
          params: {
            asset,
            network,
            isOwner: true,
          },
        },
      });
    },
    [navigation, network],
  );

  const listData = generateListArray(collectible);
  const dataProvider = new DataProvider((r1, r2) => r1 !== r2).cloneWithRows(
    listData,
  );

  const [descH, setDescH] = useState(1000);
  const layoutProvider = useMemo(
    () =>
      new LayoutProvider(
        (index) => {
          const data = listData[index];
          return data.viewType;
        },
        (type, dim) => {
          switch (type) {
            case ViewTypes.LOGO:
              dim.width = pageWidth - padding * 2;
              dim.height = collectible.logoUrl ? 56 + 8 : 0;
              break;
            case ViewTypes.NAME:
              dim.width = pageWidth - padding * 2;
              dim.height = collectible.contractName ? 52 : 0;
              break;
            case ViewTypes.DESC:
              dim.width = pageWidth - 2 * padding;
              dim.height = 24 + (collectible.description ? descH : 0);
              break;
            case ViewTypes.NFTCard:
              dim.width = cardWidth + margin;
              dim.height = cardHeight + margin;
              break;
            default:
              dim.width = 0;
              dim.height = 0;
          }
        },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [descH, pageWidth],
  );

  const rowRenderer = useCallback(
    (type, item, index) => {
      const { data } = item;
      switch (type) {
        case ViewTypes.LOGO:
          if (data) {
            return (
              <Box alignItems="center">
                <NetImage
                  src={data}
                  width="56px"
                  height="56px"
                  borderRadius="28px"
                />
              </Box>
            );
          }
          return null;
        case ViewTypes.NAME:
          return (
            <Typography.Heading mt="3" width="full" textAlign="center">
              {data}
            </Typography.Heading>
          );

        case ViewTypes.DESC:
          return (
            <Box flex={1}>
              <Typography.Body2
                color="text-subdued"
                onLayout={(e) => {
                  setDescH(e.nativeEvent.layout.height);
                }}
              >
                {data}
              </Typography.Body2>
            </Box>
          );
        case ViewTypes.NFTCard:
          return (
            <NFTListAssetCard
              asset={data as NFTAsset}
              key={index}
              onSelectAsset={handleSelectAsset}
            />
          );
        default:
          return <Box flex={1} />;
      }
    },
    [handleSelectAsset],
  );

  return (
    <Modal
      size="2xl"
      footer={null}
      height="640px"
      staticChildrenProps={{ flex: 1 }}
    >
      <Box flex={1}>
        <RecyclerListView
          flex={1}
          style={{
            flex: 1,
            width: pageWidth,
            paddingLeft: padding,
            paddingRight: padding,
          }}
          dataProvider={dataProvider}
          layoutProvider={layoutProvider}
          rowRenderer={rowRenderer}
        />
      </Box>
    </Modal>
  );
};

export default CollectionModal;

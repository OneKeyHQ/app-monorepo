import React, { FC, ReactElement, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  DataProvider,
  HStack,
  IconButton,
  LayoutProvider,
  NetImage,
  RecyclerListView,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import type { Collection, NFTAsset } from '@onekeyhq/engine/src/types/nft';

import { MAX_PAGE_CONTAINER_WIDTH } from '../../../../config';
import { CollectibleGalleryProps } from '../types';

import CollectibleCard from './CollectibleCard';
import CollectionCard from './CollectionCard';

type CollectiblesHeaderProps = {
  expand: boolean;
  onPress: () => void;
};

const CollectiblesHeader = ({ expand, onPress }: CollectiblesHeaderProps) => {
  const intl = useIntl();

  return (
    <HStack space={4} alignItems="center" justifyContent="space-between" pb={3}>
      <Typography.Heading>
        {intl.formatMessage({ id: 'asset__collectibles' })}
      </Typography.Heading>
      <IconButton
        name={expand ? 'PackupOutline' : 'ExpandOutline'}
        size="sm"
        circle
        type="plain"
        onPress={onPress}
      />
    </HStack>
  );
};

const ViewTypes = {
  HEADER: 'HEADER',
  CollectionCard: 'CollectionCard',
  NFTCard: 'NFTCard',
  CollectionHead: 'CollectionHead',
  Other: 'Other',
};
type ListDataItemType = string | Collection | NFTAsset;
// type ListDataType = ListDataItemType[];

type ListDataType = {
  viewType: string;
  data: ListDataItemType;
}[];

function generateListArray(
  originData: Collection[],
  expand: boolean,
): ListDataType {
  let result: ListDataType = [];
  result.push({ viewType: ViewTypes.HEADER, data: 'header' });
  if (expand) {
    originData.forEach((collection) => {
      const { assets } = collection;
      result.push({ viewType: ViewTypes.CollectionHead, data: collection });
      result = result.concat(
        assets.map((item) => ({
          viewType: ViewTypes.NFTCard,
          data: item,
        })),
      );
    });
  } else {
    result = result.concat(
      originData.map((item) => ({
        viewType: ViewTypes.CollectionCard,
        data: item,
      })),
    );
  }
  return result;
}

type LayoutProps = {
  padding: number;
  margin: number;
  pageWidth: number;
  cardWidth: number;
  cardHeight: number;
};

type ListProps = Pick<
  CollectibleGalleryProps,
  'collectibles' | 'onSelectAsset' | 'onSelectCollection'
> & { layout: LayoutProps; header: ReactElement };

const ExpandList: FC<ListProps> = ({
  collectibles,
  onSelectAsset,
  layout,
  header,
}) => {
  const { pageWidth, padding, margin, cardWidth, cardHeight } = layout;

  const listData = generateListArray(collectibles, true);

  const dataProvider = useMemo(
    () => new DataProvider((r1, r2) => r1 !== r2).cloneWithRows(listData),
    [listData],
  );

  const renderGridSectionHeader = (collection: Collection) => (
    <Box flexDirection="column" justifyContent="flex-start">
      <HStack alignItems="center" height="28px">
        <NetImage
          src={collection.logoUrl}
          width="20px"
          height="20px"
          borderRadius="20px"
        />
        <Typography.Subheading color="text-subdued" ml="8px" mr="12px">
          {collection.contractName}
        </Typography.Subheading>
        <Badge
          type="default"
          title={collection.ownsTotal as string}
          size="sm"
        />
      </HStack>
      {/* <BalanceText text="563.12" typography="DisplayMedium" /> */}
    </Box>
  );

  const layoutProvider = useMemo(
    () =>
      new LayoutProvider(
        (index) => {
          const data = listData[index];
          return data.viewType;
        },
        (type, dim) => {
          switch (type) {
            case ViewTypes.HEADER:
              dim.width = pageWidth - 2 * padding;
              dim.height = 70;
              break;
            case ViewTypes.CollectionHead:
              dim.width = pageWidth - 2 * padding;
              dim.height = 36;
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
    [cardHeight, cardWidth, listData, margin, padding, pageWidth],
  );

  const rowRenderer = useCallback(
    (type, item, index) => {
      const { data } = item;
      switch (type) {
        case ViewTypes.HEADER:
          return (
            <Box flex={1} key="header" height={70}>
              {header}
            </Box>
          );
        case ViewTypes.CollectionHead:
          return (
            <Box flex={1} key={`SectionHeader${index as number}`}>
              {renderGridSectionHeader(data as Collection)}
            </Box>
          );
        case ViewTypes.NFTCard:
          // eslint-disable-next-line no-case-declarations
          const { contractAddress, tokenId } = data;
          return (
            <CollectibleCard
              key={`CollectibleCard${contractAddress as string}${
                tokenId as string
              }`}
              asset={data}
              width={cardWidth}
              height={cardHeight}
              onSelectAsset={onSelectAsset}
            />
          );
        default:
          return <Box flex={1} />;
      }
    },
    [cardHeight, cardWidth, header, onSelectAsset],
  );

  return (
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
      disableRecycling
      renderFooter={() => <Box height="24px" color="background-default" />}
    />
  );
};

const PackupList: FC<ListProps> = ({
  collectibles,
  onSelectCollection,
  layout,
  header,
}) => {
  const { pageWidth, padding, margin, cardWidth, cardHeight } = layout;
  const listData = generateListArray(collectibles, false);

  // console.log('====================================');
  // console.log(
  //   'listData = ',
  //   listData.map((item) => item.viewType),
  // );
  // console.log('====================================');
  const dataProvider = new DataProvider((r1, r2) => r1 !== r2).cloneWithRows(
    listData,
  );

  const layoutProvider = new LayoutProvider(
    (index) => {
      const data = listData[index];
      return data.viewType;
    },
    (type, dim) => {
      switch (type) {
        case ViewTypes.HEADER:
          dim.width = pageWidth - 2 * padding;
          dim.height = 70;
          break;
        case ViewTypes.CollectionCard:
          dim.width = cardWidth + margin;
          dim.height = cardHeight + margin;
          break;
        default:
          dim.width = 0;
          dim.height = 0;
      }
    },
  );

  const rowRenderer = useCallback(
    (type, item) => {
      const { data } = item;

      // console.log(`rowRenderer  ${type}  index = ${index}`);
      switch (type) {
        case ViewTypes.HEADER:
          return (
            <Box flex={1} key="header" height={70}>
              {header}
            </Box>
          );
        case ViewTypes.CollectionCard:
          // eslint-disable-next-line no-case-declarations
          const { contractAddress } = data;
          return (
            <CollectionCard
              key={`CollectionCard${contractAddress as string}`}
              width={cardWidth}
              height={cardHeight}
              collectible={data}
              onSelectCollection={onSelectCollection}
            />

            // <Box
            //   borderWidth={1}
            //   bgColor={index % 2 === 0 ? 'red.400' : 'amber.400'}
            //   width={`${cardWidth + margin}px`}
            //   height={`${cardHeight + margin}px`}
            // />
          );
        default:
          return <Box flex={1} />;
      }
    },
    [cardWidth, cardHeight, header, onSelectCollection],
  );

  return (
    <RecyclerListView
      style={{
        width: pageWidth,
        paddingLeft: padding,
        paddingRight: padding,
      }}
      dataProvider={dataProvider}
      layoutProvider={layoutProvider}
      rowRenderer={rowRenderer}
      renderFooter={() => <Box height="24px" color="background-default" />}
    />
  );
};

const CollectibleGallery: FC<CollectibleGalleryProps> = ({ ...rest }) => {
  const [expand, setExpand] = React.useState(false);
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const margin = isSmallScreen ? 16 : 20;
  const padding = 16;
  const pageWidth = isSmallScreen
    ? screenWidth
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224);
  // const numColumns = isSmallScreen ? 2 : Math.floor(pageWidth / (177 + margin));
  const cardWidth = isSmallScreen
    ? Math.floor((pageWidth - padding * 2 - margin) / 2)
    : 177;
  const cardInnerPadding = isSmallScreen ? 8 : 12;
  const imageWidth = cardWidth - 2 * cardInnerPadding;
  const cardHeight = imageWidth + cardInnerPadding + 36;

  const sharedProps = React.useMemo<ListProps>(
    () => ({
      header: (
        <Box pt="26px">
          <CollectiblesHeader
            expand={false}
            onPress={() => {
              setExpand((prev) => !prev);
            }}
          />
        </Box>
      ),
      layout: {
        padding,
        margin,
        pageWidth,
        cardWidth,
        cardHeight,
      },
      ...rest,
    }),
    [cardHeight, cardWidth, margin, pageWidth, rest],
  );

  // return (
  //   <Box flex={1} minH="100%">
  //     <PackupList {...sharedProps} />
  //   </Box>
  // );
  return (
    <Box flex={1} minH="100%">
      {expand ? (
        <ExpandList {...sharedProps} />
      ) : (
        <PackupList {...sharedProps} />
      )}
    </Box>
  );
};

export default CollectibleGallery;

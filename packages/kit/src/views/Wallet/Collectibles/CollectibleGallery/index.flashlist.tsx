import React, { ComponentProps, FC, ReactElement, useCallback } from 'react';

import { FlashList, ListRenderItem } from '@shopify/flash-list';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  HStack,
  IconButton,
  NetImage,
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

type LayoutProps = {
  padding: number;
  numColumns: number;
  margin: number;
  pageWidth: number;
  cardWidth: number;
  cardHeight: number;
};

type ListProps = Pick<
  CollectibleGalleryProps,
  'collectibles' | 'onSelectAsset' | 'onSelectCollection'
> & { layout: LayoutProps; header: ReactElement };

type ListDataItemType =
  | {
      type: 'NFTAsset';
      data: NFTAsset;
    }
  | {
      type: 'Collection';
      data: Omit<Collection, 'assets'>;
    };

function generateExpandListArray(originData: Collection[]): ListDataItemType[] {
  let result: ListDataItemType[] = [];
  originData.forEach((collection) => {
    const { assets, ...props } = collection;
    result.push({ type: 'Collection', data: props });
    result = result.concat(
      assets.map(
        (asset): ListDataItemType => ({
          type: 'NFTAsset',
          data: asset,
        }),
      ),
    );
  });
  return result;
}

type SectionHeaderProps = {
  collection: Omit<Collection, 'assets'>;
} & ComponentProps<typeof Box>;
const CollectionSectionHeader: FC<SectionHeaderProps> = ({
  collection,
  ...containerProps
}) => (
  <Box flexDirection="column" justifyContent="flex-start" {...containerProps}>
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
      <Badge type="default" title={collection.ownsTotal as string} size="sm" />
    </HStack>
    {/* <BalanceText text="563.12" typography="DisplayMedium" /> */}
  </Box>
);

const ExpandList: FC<ListProps> = ({
  collectibles,
  onSelectAsset,
  layout,
  header,
}) => {
  const { pageWidth, cardHeight } = layout;
  const { screenHeight } = useUserDevice();

  const listData = generateExpandListArray(collectibles);

  const renderItem: ListRenderItem<ListDataItemType> = useCallback(
    ({ item }) => {
      if (item.type === 'Collection') {
        return (
          <CollectionSectionHeader collection={item.data} width={pageWidth} />
        );
      }
      if (item.type === 'NFTAsset') {
        return (
          <CollectibleCard asset={item.data} onSelectAsset={onSelectAsset} />
        );
      }
      return <Box />;
    },
    [onSelectAsset, pageWidth],
  );

  return (
    <FlashList
      ListHeaderComponent={header}
      style={{
        minHeight: 1,
        backgroundColor: 'red',
        flex: 1,
        width: pageWidth,
        height: screenHeight,
      }}
      data={listData}
      renderItem={renderItem}
      estimatedItemSize={cardHeight - 50}
      estimatedListSize={{ width: pageWidth, height: screenHeight }}
      ListFooterComponent={() => <Box height={20} width={pageWidth} />}
    />
  );
};

const PackupList: FC<ListProps> = ({
  collectibles,
  onSelectCollection,
  layout,
  header,
}) => {
  const { pageWidth, cardHeight, numColumns } = layout;
  const { screenHeight } = useUserDevice();

  const renderItem: ListRenderItem<Collection> = useCallback(
    ({ item }) => (
      <CollectionCard
        collectible={item}
        onSelectCollection={onSelectCollection}
      />
    ),
    [onSelectCollection],
  );

  return (
    <FlashList
      ListHeaderComponent={header}
      style={{
        minHeight: 1,
        backgroundColor: 'red',
        flex: 1,
        width: pageWidth,
        height: screenHeight,
      }}
      data={collectibles}
      numColumns={numColumns}
      renderItem={renderItem}
      estimatedItemSize={cardHeight - 50}
      estimatedListSize={{ width: pageWidth, height: screenHeight }}
      ListFooterComponent={() => <Box height={20} width={pageWidth} />}
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
  const numColumns = isSmallScreen ? 2 : Math.floor(pageWidth / (177 + margin));
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
        numColumns,
        margin,
        pageWidth,
        cardWidth,
        cardHeight,
      },
      ...rest,
    }),
    [cardHeight, cardWidth, margin, numColumns, pageWidth, rest],
  );

  return (
    <Box flex={1} bgColor="red.100" paddingLeft={`${padding}px`}>
      {expand ? (
        <ExpandList {...sharedProps} />
      ) : (
        <PackupList {...sharedProps} />
      )}
    </Box>
  );
};

export default CollectibleGallery;

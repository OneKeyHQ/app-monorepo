import React, { FC } from 'react';

import {
  Badge,
  Box,
  Divider,
  Empty,
  HStack,
  Icon,
  NftCard,
  Pressable,
  ScrollableFlatList,
  ScrollableFlatListProps,
  ScrollableSectionList,
  ScrollableSectionListProps,
  SegmentedControl,
  Token,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';

import { Asset, Collectible, CollectibleView, SelectedAsset } from './types';

// List
type CollectibleListProps = {
  index: number;
  collectibles: Collectible[];
  renderEmpty: ScrollableFlatListProps<Collectible>['ListEmptyComponent'];
  renderHeader: ScrollableFlatListProps<Collectible>['ListHeaderComponent'];
  onPressItem: (item: Collectible) => void;
};

const CollectibleList: FC<CollectibleListProps> = ({
  index,
  renderEmpty,
  renderHeader,
  collectibles,
  onPressItem,
}) => {
  const renderItem: ScrollableFlatListProps<Collectible>['renderItem'] = ({
    item,
    index: itemIndex,
  }) => (
    <Pressable.Item
      p={4}
      borderTopRadius={itemIndex === 0 ? '12px' : '0px'}
      borderRadius={itemIndex === collectibles.length - 1 ? '12px' : '0px'}
      onPress={() => onPressItem(item)}
    >
      <HStack space={3} w="100%" flexDirection="row" alignItems="center">
        <Token src={item.collection.imageUrl ?? undefined} />
        <Box flex={1}>
          <Typography.Body1Strong color="text-default">
            {item.collection.name}
          </Typography.Body1Strong>
        </Box>
        <HStack space={3}>
          <Badge
            type="Default"
            title={item.assets.length.toString()}
            size="sm"
          />
          <Icon size={20} name="ChevronRightSolid" />
        </HStack>
      </HStack>
    </Pressable.Item>
  );

  return (
    <ScrollableFlatList
      index={index}
      renderItem={renderItem}
      keyExtractor={(_, idx) => String(idx)}
      ListEmptyComponent={renderEmpty}
      ListHeaderComponent={renderHeader}
      ItemSeparatorComponent={Divider}
      ListFooterComponent={() => <Box h="20px" />}
      data={collectibles}
      extraData={collectibles}
      style={{
        backgroundColor: !collectibles.length ? 'initial' : 'surface-default',
        borderRadius: 12,
      }}
    />
  );
};

// Grid
type CollectibleSection = { title: string; data: [Collectible] };
type CollectibleGridProps = {
  index: number;
  collectibleSections: CollectibleSection[];
  renderHeader: ScrollableSectionListProps<Collectible>['ListHeaderComponent'];
  renderEmpty: ScrollableSectionListProps<Collectible>['ListEmptyComponent'];
  onPressItem: (item: SelectedAsset) => void;
};

const stringAppend = (...args: Array<string | null | undefined>) =>
  args.filter(Boolean).join('');

const CollectibleGrid: FC<CollectibleGridProps> = ({
  renderHeader,
  renderEmpty,
  index: tabPageIndex,
  collectibleSections,
  onPressItem,
}) => {
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);

  const renderItem: ScrollableSectionListProps<Collectible>['renderItem'] = ({
    item: col,
  }) => (
    <HStack flexWrap="wrap" alignItems="center" space={0} divider={<></>}>
      {col.assets.map((asset, itemIndex) => {
        const marginRight = isSmallScreen && !(itemIndex % 2 === 0) ? 0 : 4;

        return (
          <NftCard
            key={
              asset.id ??
              stringAppend(col.collection.name, asset.name, asset.tokenId)
            }
            image={asset.imageUrl}
            title={asset.name}
            mr={marginRight}
            mb={4}
            borderColor="background-default"
            onPress={() =>
              onPressItem({
                ...asset,
                chain: col.chain,
                contractAddress: col.contract.address,
              })
            }
          />
        );
      })}
    </HStack>
  );

  const renderSectionHeader: ScrollableSectionListProps<Collectible>['renderSectionHeader'] =
    ({
      section: {
        data: [col],
        title,
      },
    }) => (
      <HStack space={3} py={2} pb={2} alignItems="center">
        <Typography.Subheading color="text-subdued">
          {title}
        </Typography.Subheading>
        {!!col.assets?.length && (
          <Badge
            type="Default"
            title={col.assets.length.toString()}
            size="sm"
          />
        )}
      </HStack>
    );

  return (
    <ScrollableSectionList
      index={tabPageIndex}
      sections={collectibleSections}
      extraData={collectibleSections}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListEmptyComponent={renderEmpty}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={() => <Box h="20px" />}
      ItemSeparatorComponent={() => <Divider />}
      keyExtractor={(item: Collectible, index) =>
        String(item.id ?? item.collection.name ?? index)
      }
      showsVerticalScrollIndicator={false}
    />
  );
};

type CollectibleGalleryProps = {
  collectibles: Collectible[];
  index: number;
  onSelectCollectible: (cols: Collectible) => void;
  onSelectAsset: (asset: Asset) => void;
};

const toSections = (collectibles: Collectible[]) =>
  collectibles.map<CollectibleSection>((col) => ({
    title: col.collection.name ?? col.assets?.[0]?.name ?? 'Unknown',
    // In order to render the grid view, we use [assets] as the data
    data: [col],
  }));

const CollectibleGallery: FC<CollectibleGalleryProps> = ({
  index,
  collectibles,
  onSelectAsset,
  onSelectCollectible,
}) => {
  const [view, setView] = React.useState(CollectibleView.Flat);
  // Set it to grid view when not in mobile
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);
  React.useEffect(() => {
    if (!isSmallScreen) {
      return setView(CollectibleView.Grid);
    }
  }, [isSmallScreen]);

  const renderEmpty = () => (
    <Empty title="No Collectible" subTitle="NFTs will show here" />
  );

  const renderHeader = React.useCallback(() => {
    if (!isSmallScreen || !collectibles.length) return null;

    return (
      <HStack
        space={4}
        alignItems="center"
        justifyContent="space-between"
        pb={4}
      >
        <Typography.Heading>Collectibles</Typography.Heading>
        <Pressable
          // no delay acts like debounce
          delayLongPress={0}
          onPress={() =>
            setView((newView) =>
              newView === CollectibleView.Flat
                ? CollectibleView.Grid
                : CollectibleView.Flat,
            )
          }
        >
          <SegmentedControl
            containerProps={{
              width: 70,
              height: 35,
            }}
            options={[
              {
                iconName: 'ViewListSolid',
                value: CollectibleView.Flat,
              },
              {
                iconName: 'ViewGridSolid',
                value: CollectibleView.Grid,
              },
            ]}
            defaultValue={view}
          />
        </Pressable>
      </HStack>
    );
  }, [collectibles, isSmallScreen, view]);

  if (view === CollectibleView.Flat) {
    return (
      <CollectibleList
        index={index}
        renderHeader={renderHeader}
        renderEmpty={renderEmpty}
        collectibles={collectibles}
        onPressItem={onSelectCollectible}
      />
    );
  }

  return (
    <CollectibleGrid
      index={index}
      renderHeader={renderHeader}
      renderEmpty={renderEmpty}
      collectibleSections={toSections(collectibles)}
      onPressItem={onSelectAsset}
    />
  );
};

export default CollectibleGallery;

import React, { FC } from 'react';

import {
  Badge,
  Box,
  Divider,
  Empty,
  FlatList,
  HStack,
  Icon,
  NftCard,
  Pressable,
  SectionList,
  Token,
  Typography,
} from '@onekeyhq/components';

import { Asset, Collectible, CollectibleView, SelectedAsset } from './types';

// List
type CollectibleListProps = {
  collectibles: Collectible[];
  onPressItem: (item: Collectible) => void;
};

const CollectibleList: FC<CollectibleListProps> = ({
  collectibles,
  onPressItem,
}) => {
  const renderItem = ({ item }: { item: Collectible }) => (
    <Pressable p={4} onPress={() => onPressItem(item)}>
      <HStack space={3} w="100%" flexDirection="row" alignItems="center">
        <Token src={item.collection.imageUrl ?? undefined} />
        <Box flex={1}>
          <Typography.Body1 color="text-default" fontWeight="bold">
            {item.collection.name}
          </Typography.Body1>
        </Box>
        <HStack space={2}>
          <Badge
            type="Default"
            title={item.assets.length.toString()}
            size="sm"
          />
          <Icon name="ChevronRightOutline" />
        </HStack>
      </HStack>
    </Pressable>
  );

  return (
    <FlatList<Collectible>
      bg={!collectibles.length ? 'initial' : 'surface-default'}
      borderRadius="12px"
      renderItem={renderItem}
      keyExtractor={(_, idx) => String(idx)}
      ItemSeparatorComponent={Divider}
      data={collectibles}
      extraData={collectibles}
    />
  );
};

// Grid
type CollectibleSection = { title: string; data: [Collectible] };
type CollectibleGridProps = {
  collectibleSections: CollectibleSection[];
  onPressItem: (item: SelectedAsset) => void;
};

const stringAppend = (...args: Array<string | null | undefined>) =>
  args.filter(Boolean).join('');

const CollectibleGrid: FC<CollectibleGridProps> = ({
  collectibleSections,
  onPressItem,
}) => {
  const renderItem = ({
    item: col,
  }: {
    item: CollectibleSection['data'][number];
  }) => (
    <HStack flexWrap="wrap" alignItems="center" space={0} divider={<></>}>
      {col.assets.map((asset) => (
        <NftCard
          key={
            asset.id ??
            stringAppend(col.collection.name, asset.name, asset.tokenId)
          }
          image={asset.imageUrl}
          title={asset.name}
          w={{ sm: '45%', md: '177px', base: '173px' }}
          minW={['auto', '177px']}
          maxH="222px"
          mb={4}
          mr={4}
          borderColor="background-default"
          onPress={() =>
            onPressItem({
              ...asset,
              chain: col.chain,
              contractAddress: col.contract.address,
            })
          }
        />
      ))}
    </HStack>
  );

  const renderSectionHeader = ({
    section: {
      data: [assets],
      title,
    },
  }: {
    section: { data: [Asset[]]; title: string };
  }) => (
    <HStack space={3} py={2} alignItems="center">
      <Typography.Subheading color="text-subdued">
        {title}
      </Typography.Subheading>
      {!!assets?.length && (
        <Badge type="Default" title={assets.length.toString()} size="sm" />
      )}
    </HStack>
  );

  return (
    <SectionList
      sections={collectibleSections}
      extraData={collectibleSections}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ItemSeparatorComponent={() => <Divider />}
      keyExtractor={(item: Asset, index) =>
        String(item.id ?? item.name ?? index)
      }
      showsVerticalScrollIndicator={false}
    />
  );
};

type CollectibleGalleryProps = {
  collectibles: Collectible[];
  view: CollectibleView;
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
  collectibles,
  view,
  onSelectAsset,
  onSelectCollectible,
}) => {
  if (!collectibles?.length) {
    return <Empty title="No Collectible" subTitle="NFTs will show here" />;
  }

  if (view === CollectibleView.Flat) {
    return (
      <CollectibleList
        collectibles={collectibles}
        onPressItem={onSelectCollectible}
      />
    );
  }

  return (
    <CollectibleGrid
      collectibleSections={toSections(collectibles)}
      onPressItem={onSelectAsset}
    />
  );
};

export default CollectibleGallery;

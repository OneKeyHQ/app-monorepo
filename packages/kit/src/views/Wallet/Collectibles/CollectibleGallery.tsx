import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Center,
  Divider,
  Empty,
  HStack,
  Icon,
  Image,
  NftCard,
  Pressable,
  ScrollableFlatListProps,
  SegmentedControl,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';

import { Collectible, CollectibleView, SelectedAsset } from './types';

const ItemImage: FC<{ src?: string | null; size?: number }> = ({
  src,
  size = 8,
}) => {
  const fallbackElement = React.useMemo(
    () => (
      <Center
        borderRadius="full"
        bg="surface-neutral-default"
        width={size}
        height={size}
      >
        <Icon size={20} name="QuestionMarkCircleSolid" color="icon-default" />
      </Center>
    ),
    [size],
  );

  if (!src) return fallbackElement;

  return (
    <Image
      src={src}
      key={src}
      alt={src}
      width={size}
      height={size}
      fallbackElement={fallbackElement}
      borderRadius="full"
    />
  );
};

const stringAppend = (...args: Array<string | null | undefined>) =>
  args.filter(Boolean).join('');

type CollectibleGalleryProps = {
  collectibles: Collectible[];
  onSelectCollectible: (cols: Collectible) => void;
  onSelectAsset: (asset: SelectedAsset) => void;
};

const CollectibleGallery: FC<CollectibleGalleryProps> = ({
  collectibles,
  onSelectAsset,
  onSelectCollectible,
}) => {
  const intl = useIntl();
  const [view, setView] = React.useState(CollectibleView.Flat);
  // Set it to grid view when not in mobile
  const isSmallScreen = useIsVerticalLayout();
  React.useEffect(() => {
    if (!isSmallScreen) {
      return setView(CollectibleView.Grid);
    }
  }, [isSmallScreen]);

  const renderEmpty = React.useCallback(
    () => (
      <Empty
        title={intl.formatMessage({ id: 'asset__collectibles_empty_title' })}
        subTitle={intl.formatMessage({ id: 'asset__collectibles_empty_desc' })}
      />
    ),
    [intl],
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
        <Typography.Heading>
          {intl.formatMessage({ id: 'asset__collectibles' })}
        </Typography.Heading>
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
          onChange={(value) => setView(value as CollectibleView)}
          defaultValue={view}
        />
      </HStack>
    );
  }, [collectibles.length, intl, isSmallScreen, view]);

  const renderListItem = React.useCallback<
    NonNullable<ScrollableFlatListProps<Collectible>['renderItem']>
  >(
    ({ item, index: itemIndex }) => (
      <Pressable.Item
        p={4}
        borderTopRadius={itemIndex === 0 ? '12px' : '0px'}
        borderRadius={itemIndex === collectibles.length - 1 ? '12px' : '0px'}
        onPress={() => onSelectCollectible(item)}
      >
        <HStack space={3} w="100%" flexDirection="row" alignItems="center">
          <ItemImage src={item.collection.imageUrl} />
          <Box flex={1}>
            <Typography.Body1Strong color="text-default">
              {item.collection.name}
            </Typography.Body1Strong>
          </Box>
          <HStack space={3}>
            <Badge
              type="default"
              title={item.assets.length.toString()}
              size="sm"
            />
            <Icon size={20} name="ChevronRightSolid" />
          </HStack>
        </HStack>
      </Pressable.Item>
    ),
    [collectibles.length, onSelectCollectible],
  );

  const renderGridSectionHeader = (
    title?: string | null,
    length?: number | null,
  ) => (
    <HStack space={3} py={2} pb={2} alignItems="center">
      <Typography.Subheading color="text-subdued">
        {title}
      </Typography.Subheading>
      {!!length && <Badge type="default" title={length.toString()} size="sm" />}
    </HStack>
  );

  const renderGridItem = React.useCallback<
    NonNullable<ScrollableFlatListProps<Collectible>['renderItem']>
  >(
    ({ item }) => {
      const header = renderGridSectionHeader(
        item.collection.name,
        item.assets.length,
      );

      return (
        <VStack space={1} mb={4}>
          {header}
          <HStack flexWrap="wrap" alignItems="center" space={0} divider={<></>}>
            {item.assets.map((asset, itemIndex) => {
              const marginRight =
                isSmallScreen && !(itemIndex % 2 === 0) ? 0 : 4;

              return (
                <NftCard
                  key={
                    asset.id ??
                    stringAppend(
                      item.collection.name,
                      asset.name,
                      asset.tokenId,
                    )
                  }
                  image={asset.imageUrl}
                  title={asset.name}
                  mr={marginRight}
                  mb={4}
                  borderColor="background-default"
                  onPress={() =>
                    onSelectAsset({
                      ...asset,
                      chain: item.chain,
                      contractAddress: item.contract.address,
                    })
                  }
                />
              );
            })}
          </HStack>
        </VStack>
      );
    },
    [isSmallScreen, onSelectAsset],
  );

  const sharedProps = React.useMemo(
    () => ({
      contentContainerStyle: { paddingHorizontal: 16, marginTop: 16 },
      keyExtractor: ((_, idx) =>
        String(idx)) as ScrollableFlatListProps['keyExtractor'],
      ListEmptyComponent: renderEmpty,
      ListHeaderComponent: renderHeader,
      ListFooterComponent: () => <Box h="20px" />,
      data: collectibles,
      extraData: collectibles,
    }),
    [collectibles, renderEmpty, renderHeader],
  );

  const flatListProps = React.useMemo(
    () => ({
      style: {
        backgroundColor: !collectibles.length ? 'initial' : 'surface-default',
        borderRadius: 12,
      },
      renderItem: renderListItem,
      ItemSeparatorComponent: Divider,
    }),
    [collectibles.length, renderListItem],
  );

  const gridListProps = React.useMemo(
    () => ({
      renderItem: renderGridItem,
    }),
    [renderGridItem],
  );

  const mergedProps = {
    ...(view === CollectibleView.Flat ? flatListProps : gridListProps),
    ...sharedProps,
  };

  return <Tabs.FlatList<Collectible> {...mergedProps} />;
};

export default CollectibleGallery;

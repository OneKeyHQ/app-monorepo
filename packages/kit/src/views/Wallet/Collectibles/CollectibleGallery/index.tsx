import React, { ComponentProps, FC, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { SectionListRenderItem } from 'react-native';

import {
  Badge,
  Box,
  Empty,
  FlatList,
  HStack,
  IconButton,
  NetImage,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { FlatListProps } from '@onekeyhq/components/src/FlatList';
import type { Collection, NFTAsset } from '@onekeyhq/engine/src/types/nft';
import IconNFT from '@onekeyhq/kit/assets/3d_nft.png';

import { MAX_PAGE_CONTAINER_WIDTH } from '../../../../config';
import { CollectibleGalleryProps } from '../types';

import CollectibleCard from './CollectibleCard';
import CollectionCard from './CollectionCard';

const stringAppend = (...args: Array<string | null | undefined>) =>
  args.filter(Boolean).join('');
type CollectiblesHeaderProps = {
  expand: boolean;
  onPress: () => void;
};

const CollectiblesHeader = ({ expand, onPress }: CollectiblesHeaderProps) => {
  const intl = useIntl();

  return (
    <HStack
      space={4}
      alignItems="center"
      justifyContent="space-between"
      pb={3}
      paddingRight="16px"
    >
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

type FlatListShareProps = Pick<
  ComponentProps<typeof FlatList>,
  | 'ListEmptyComponent'
  | 'ListFooterComponent'
  | 'ListHeaderComponent'
  | 'contentContainerStyle'
  | 'showsVerticalScrollIndicator'
  | 'numColumns'
>;

type CollectionSection = {
  title: Omit<Collection, 'assets'>;
  data: { assets: NFTAsset[] }[];
};

const CollectibleSectionList: FC<
  CollectibleGalleryProps & { flatListProps: FlatListShareProps }
> = ({ collectibles, onSelectAsset, flatListProps }) => {
  const { numColumns } = flatListProps;
  const renderGridSectionHeader = (
    logo?: string,
    title?: string | null,
    length?: number | string | null,
  ) => (
    <Box flexDirection="column" justifyContent="flex-start">
      <HStack alignItems="center" height="28px">
        {!!logo && (
          <NetImage src={logo} width="20px" height="20px" borderRadius="20px" />
        )}
        <Typography.Subheading color="text-subdued" ml="8px" mr="12px">
          {title}
        </Typography.Subheading>
        {!!length && (
          <Badge type="default" title={length.toString()} size="sm" />
        )}
      </HStack>
      {/* <BalanceText text="563.12" typography="DisplayMedium" /> */}
    </Box>
  );

  const renderAssetItem = React.useCallback<
    NonNullable<FlatListProps<NFTAsset>['renderItem']>
  >(
    ({ item }) => (
      <CollectibleCard
        key={stringAppend(item.contractAddress, item.tokenId)}
        marginRight="16px"
        asset={item}
        onSelectAsset={onSelectAsset}
      />
    ),
    [onSelectAsset],
  );

  const renderList: SectionListRenderItem<Collection, CollectionSection> =
    useCallback(
      ({ item }) => (
        <FlatList
          data={item.assets}
          renderItem={renderAssetItem}
          numColumns={numColumns}
        />
      ),
      [numColumns, renderAssetItem],
    );

  const sections: CollectionSection[] = collectibles.map(
    (collection): CollectionSection => {
      const { assets, ...props } = collection;
      return {
        data: [{ assets }],
        title: props,
      };
    },
  );

  return (
    <Tabs.SectionList
      sections={sections}
      stickySectionHeadersEnabled={false}
      // @ts-ignore
      renderSectionHeader={({ section }: { section: CollectionSection }) => {
        const header = renderGridSectionHeader(
          section.title.logoUrl,
          section.title.contractName,
          section.title.ownsTotal,
        );

        return header;
      }}
      // @ts-ignore
      renderItem={renderList}
      {...flatListProps}
    />
  );
};

const CollectibleFlatList: FC<
  CollectibleGalleryProps & { flatListProps: FlatListShareProps }
> = ({ collectibles, onSelectCollection, flatListProps }) => {
  const renderCollectionItem = React.useCallback<
    NonNullable<FlatListProps<Collection>['renderItem']>
  >(
    ({ item }) => (
      <CollectionCard
        collectible={item}
        mr="16px"
        onSelectCollection={onSelectCollection}
      />
    ),
    [onSelectCollection],
  );
  return (
    <Tabs.FlatList<Collection>
      {...flatListProps}
      data={collectibles}
      renderItem={renderCollectionItem}
      keyExtractor={(item) => `${item.contractAddress ?? ''}Collection`}
    />
  );
};

const CollectibleGallery: FC<CollectibleGalleryProps> = ({
  collectibles,
  onSelectAsset,
  onSelectCollection,
  fetchData,
  isCollectibleSupported,
  isLoading,
}) => {
  const [expand, setExpand] = React.useState(false);
  const intl = useIntl();

  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const MARGIN = isSmallScreen ? 16 : 20;
  const pageWidth = isSmallScreen
    ? screenWidth
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224);
  const numColumns = isSmallScreen ? 2 : Math.floor(pageWidth / (177 + MARGIN));

  const EmptyView = useMemo(() => {
    if (!isCollectibleSupported) {
      return (
        <Empty
          imageUrl={IconNFT}
          title={intl.formatMessage({ id: 'empty__not_supported' })}
          subTitle={intl.formatMessage({ id: 'empty__not_supported_desc' })}
        />
      );
    }
    return (
      <Empty
        imageUrl={IconNFT}
        title={intl.formatMessage({
          id: 'asset__collectibles_empty_title',
        })}
        subTitle={intl.formatMessage({
          id: 'asset__collectibles_empty_desc',
        })}
        actionTitle={intl.formatMessage({ id: 'action__refresh' })}
        handleAction={fetchData}
        isLoading={isLoading}
      />
    );
  }, [fetchData, intl, isCollectibleSupported, isLoading]);

  const sharedProps = React.useMemo(
    () => ({
      contentContainerStyle: {
        paddingLeft: 16,
        paddingBottom: collectibles.length ? 16 : 0,
        marginTop: 24,
      },
      key: expand ? 'Expand' : `Packup${numColumns}`,
      ListFooterComponent: <Box h="24px" w="full" />,
      showsVerticalScrollIndicator: false,
      ListEmptyComponent: EmptyView,
      numColumns,
      ListHeaderComponent: (
        <CollectiblesHeader
          expand={expand}
          onPress={() => {
            setExpand((prev) => !prev);
          }}
        />
      ),
      data: collectibles,
    }),
    [EmptyView, collectibles, expand, numColumns],
  );

  return (
    <Box>
      {expand ? (
        <CollectibleSectionList
          flatListProps={sharedProps}
          collectibles={collectibles}
          onSelectAsset={onSelectAsset}
        />
      ) : (
        <CollectibleFlatList
          flatListProps={sharedProps}
          collectibles={collectibles}
          onSelectCollection={onSelectCollection}
        />
      )}
    </Box>
  );
};

export default CollectibleGallery;

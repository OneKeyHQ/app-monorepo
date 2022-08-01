import React, { FC, useCallback } from 'react';

import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';
import { FlatListProps } from 'react-native';

import {
  Badge,
  Box,
  Center,
  Empty,
  HStack,
  IconButton,
  NetImage,
  Pressable,
  ScrollableFlatListProps,
  Spinner,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { Collectible } from '@onekeyhq/engine/src/types/nftscan';
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

const CollectibleGallery: FC<CollectibleGalleryProps> = ({
  isLoading,
  isSupported,
  collectibles,
  fetchData,
  onSelectAsset,
  onSelectCollectible,
}) => {
  const intl = useIntl();
  const [expand, setExpand] = React.useState(false);
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const MARGIN = isSmallScreen ? 16 : 20;
  const pageWidth = isSmallScreen
    ? screenWidth
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224);
  const numColumns = isSmallScreen ? 2 : Math.floor(pageWidth / (177 + MARGIN));

  const renderEmpty = React.useCallback(() => {
    if (!isSupported) {
      return (
        <Box py={4}>
          <Empty
            imageUrl={IconNFT}
            title={intl.formatMessage({ id: 'empty__not_supported' })}
            subTitle={intl.formatMessage({ id: 'empty__not_supported_desc' })}
          />
        </Box>
      );
    }

    return isLoading ? (
      <Center pb={8} pt={8}>
        <Spinner size="lg" />
      </Center>
    ) : (
      <Box py={4}>
        <Empty
          imageUrl={IconNFT}
          title={intl.formatMessage({ id: 'asset__collectibles_empty_title' })}
          subTitle={intl.formatMessage({
            id: 'asset__collectibles_empty_desc',
          })}
          actionTitle={intl.formatMessage({ id: 'action__refresh' })}
          handleAction={fetchData}
        />
      </Box>
    );
  }, [intl, isLoading, isSupported, fetchData]);

  const renderGridSectionHeader = (
    logo?: string,
    title?: string | null,
    length?: number | null,
  ) => (
    <Box flexDirection="column" justifyContent="flex-start">
      <HStack alignItems="center" height="28px">
        <NetImage src={logo} width="20px" height="20px" borderRadius="20px" />
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
    NonNullable<ScrollableFlatListProps<Collectible>['renderItem']>
  >(
    ({ item }) => {
      const header = renderGridSectionHeader(
        item.logoUrl,
        item.contractName,
        item.assets.length,
      );
      return (
        <Column space="8px">
          {header}
          <Row flexWrap="wrap">
            {item.assets.map((asset, itemIndex) => {
              const marginRight =
                isSmallScreen && !(itemIndex % 2 === 0) ? 0 : 16;
              return (
                <Pressable
                  key={stringAppend(asset.contractAddress, asset.tokenId)}
                  onPress={() => {
                    if (onSelectAsset) {
                      onSelectAsset(asset);
                    }
                  }}
                >
                  <CollectibleCard
                    marginRight={`${marginRight}px`}
                    asset={asset}
                  />
                </Pressable>
              );
            })}
          </Row>
        </Column>
      );
    },
    [isSmallScreen, onSelectAsset],
  );

  const renderCollectionItem = React.useCallback<
    NonNullable<ScrollableFlatListProps<Collectible>['renderItem']>
  >(
    ({ item }) => (
      <Pressable
        onPress={() => {
          if (onSelectCollectible) {
            onSelectCollectible(item);
          }
        }}
      >
        <CollectionCard collectible={item} mr="16px" />
      </Pressable>
    ),
    [onSelectCollectible],
  );

  const sharedProps = React.useMemo<FlatListProps<Collectible>>(
    () => ({
      contentContainerStyle: {
        paddingLeft: 16,
        paddingBottom: collectibles.length ? 16 : 0,
        marginTop: 24,
      },
      key: expand ? 'Expand' : `Packup${numColumns}`,
      keyExtractor: ((_, idx) =>
        String(idx)) as ScrollableFlatListProps['keyExtractor'],
      ListEmptyComponent: renderEmpty,
      ListFooterComponent: <Box h="24px" w="full" />,
      refreshing: isSupported ? isLoading : undefined,
      onRefresh: isSupported && collectibles.length ? fetchData : undefined,
      showsVerticalScrollIndicator: false,
      renderItem: expand ? renderAssetItem : renderCollectionItem,
      numColumns: expand ? 1 : numColumns,
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
    [
      collectibles,
      expand,
      fetchData,
      isLoading,
      isSupported,
      numColumns,
      renderAssetItem,
      renderCollectionItem,
      renderEmpty,
    ],
  );
  return <Tabs.FlatList<Collectible> {...sharedProps} />;
};

export default CollectibleGallery;

import React, { FC } from 'react';

import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';
import { FlatListProps } from 'react-native';

import {
  Badge,
  Box,
  HStack,
  IconButton,
  NetImage,
  ScrollableFlatListProps,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { Collection } from '@onekeyhq/engine/src/types/nft';

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

const CollectibleGallery: FC<CollectibleGalleryProps> = ({
  collectibles,
  onSelectAsset,
  onSelectCollection,
}) => {
  const [expand, setExpand] = React.useState(false);
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const MARGIN = isSmallScreen ? 16 : 20;
  const pageWidth = isSmallScreen
    ? screenWidth
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224);
  const numColumns = isSmallScreen ? 2 : Math.floor(pageWidth / (177 + MARGIN));

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
    NonNullable<ScrollableFlatListProps<Collection>['renderItem']>
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
                <CollectibleCard
                  key={stringAppend(asset.contractAddress, asset.tokenId)}
                  marginRight={`${marginRight}px`}
                  asset={asset}
                  onSelectAsset={onSelectAsset}
                />
              );
            })}
          </Row>
        </Column>
      );
    },
    [isSmallScreen, onSelectAsset],
  );

  const renderCollectionItem = React.useCallback<
    NonNullable<ScrollableFlatListProps<Collection>['renderItem']>
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

  const sharedProps = React.useMemo<FlatListProps<Collection>>(
    () => ({
      contentContainerStyle: {
        paddingLeft: 16,
        paddingBottom: collectibles.length ? 16 : 0,
        marginTop: 24,
      },
      key: expand ? 'Expand' : `Packup${numColumns}`,
      keyExtractor: ((_, idx) =>
        String(idx)) as ScrollableFlatListProps['keyExtractor'],
      ListFooterComponent: <Box h="24px" w="full" />,
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
    [collectibles, expand, numColumns, renderAssetItem, renderCollectionItem],
  );
  return <Tabs.FlatList<Collection> {...sharedProps} />;
};

export default CollectibleGallery;

import React, { FC } from 'react';

import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';
import { FlatListProps } from 'react-native';

import {
  Badge,
  Box,
  HStack,
  IconButton,
  Pressable,
  ScrollableFlatListProps,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { Collectible } from '@onekeyhq/engine/src/types/moralis';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { CollectibleGalleryProps, CollectibleView } from '../types';

import CollectibleCard from './CollectibleCard';

const stringAppend = (...args: Array<string | null | undefined>) =>
  args.filter(Boolean).join('');

type CollectiblesHeaderProps = {
  view: CollectibleView;
  onPress: () => void;
};

const CollectiblesHeader = ({ view, onPress }: CollectiblesHeaderProps) => {
  const intl = useIntl();

  return (
    <HStack space={4} alignItems="center" justifyContent="space-between" pb={3}>
      <Typography.Heading>
        {intl.formatMessage({ id: 'asset__collectibles' })}
      </Typography.Heading>
      {!platformEnv.isNativeAndroid && (
        <IconButton
          name={
            view === CollectibleView.Expand ? 'PackupOutline' : 'ExpandOutline'
          }
          size="sm"
          circle
          type="plain"
          onPress={onPress}
        />
      )}
    </HStack>
  );
};

const ExpandList: FC<
  CollectibleGalleryProps & {
    flatListProps: Omit<FlatListProps<Collectible>, 'renderItem'>;
    onPress: () => void;
  }
> = ({ onSelectAsset, flatListProps, onPress }) => {
  // Set it to grid view when not in mobile
  const isSmallScreen = useIsVerticalLayout();

  const renderGridSectionHeader = (
    title?: string | null,
    length?: number | null,
  ) => (
    <Box flexDirection="column" justifyContent="flex-start">
      <HStack space="12px" alignItems="center" height="28px">
        <Typography.Subheading color="text-subdued">
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
        item.collection.name,
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
                  key={stringAppend(
                    asset.tokenAddress,
                    asset.tokenId,
                    asset.tokenHash,
                  )}
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

  return (
    <Tabs.FlatList<Collectible>
      ListHeaderComponent={
        <CollectiblesHeader view={CollectibleView.Expand} onPress={onPress} />
      }
      renderItem={renderAssetItem}
      {...flatListProps}
    />
  );
};

export default ExpandList;

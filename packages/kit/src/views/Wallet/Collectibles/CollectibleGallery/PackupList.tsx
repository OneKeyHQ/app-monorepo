import React, { FC } from 'react';

import { useIntl } from 'react-intl';
import { FlatListProps } from 'react-native';
// @ts-expect-error
import NestedScrollView from 'react-native-nested-scroll-view';

import {
  FlatList,
  HStack,
  IconButton,
  ScrollableFlatListProps,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import type { Collectible } from '@onekeyhq/engine/src/types/moralis';

import { MAX_PAGE_CONTAINER_WIDTH } from '../../../../config';
import { CollectibleGalleryProps, CollectibleView } from '../types';

import CollectionCard from './CollectionCard';

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
      <IconButton
        name={
          view === CollectibleView.Expand ? 'PackupOutline' : 'ExpandOutline'
        }
        size="sm"
        circle
        type="plain"
        onPress={onPress}
      />
    </HStack>
  );
};

const PackupList: FC<
  CollectibleGalleryProps & {
    flatListProps: Omit<FlatListProps<Collectible>, 'renderItem'>;
    onPress: () => void;
  }
> = ({ flatListProps, onPress, onSelectCollectible, isTab }) => {
  // Set it to grid view when not in mobile
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const MARGIN = isSmallScreen ? 16 : 20;
  const width = isSmallScreen ? screenWidth : MAX_PAGE_CONTAINER_WIDTH;
  const numColumns = isSmallScreen ? 2 : Math.floor(width / (177 + MARGIN));
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

  const Container = isTab ? Tabs.FlatList : FlatList;

  return (
    <Container<Collectible>
      numColumns={numColumns}
      ListHeaderComponent={
        <CollectiblesHeader view={CollectibleView.Packup} onPress={onPress} />
      }
      renderItem={renderCollectionItem}
      renderScrollComponent={(viewProps) => <NestedScrollView {...viewProps} />}
      {...flatListProps}
    />
  );
};

export default PackupList;

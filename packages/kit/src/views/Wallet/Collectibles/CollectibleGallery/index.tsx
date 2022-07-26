import React, { FC } from 'react';

import { useIntl } from 'react-intl';
import { FlatListProps } from 'react-native';

import {
  Box,
  Center,
  Empty,
  ScrollableFlatListProps,
  Spinner,
  useUserDevice,
} from '@onekeyhq/components';
import type { Collectible } from '@onekeyhq/engine/src/types/moralis';
import IconNFT from '@onekeyhq/kit/assets/3d_nft.png';

import { CollectibleGalleryProps, CollectibleView } from '../types';

import ExpandList from './ExpandList';
import PackupList from './PackupList';

const CollectibleGallery: FC<CollectibleGalleryProps> = ({
  isLoading,
  isSupported,
  collectibles,
  fetchData,
  onSelectAsset,
  onSelectCollectible,
  ...props
}) => {
  const intl = useIntl();
  const [view, setView] = React.useState(CollectibleView.Packup);

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

  const { size } = useUserDevice();
  const sharedProps = React.useMemo<
    Omit<FlatListProps<Collectible>, 'renderItem'>
  >(
    () => ({
      contentContainerStyle: {
        paddingHorizontal: ['NORMAL', 'LARGE'].includes(size) ? 32 : 16,
        paddingBottom: collectibles.length ? 16 : 0,
        marginTop: 24,
      },
      keyExtractor: ((_, idx) =>
        String(idx)) as ScrollableFlatListProps['keyExtractor'],
      ListEmptyComponent: renderEmpty,
      ListFooterComponent: <Box h="24px" w="full" />,
      refreshing: isSupported ? isLoading : undefined,
      onRefresh: isSupported && collectibles.length ? fetchData : undefined,
      showsVerticalScrollIndicator: false,
      data: collectibles,
    }),
    [collectibles, fetchData, isLoading, isSupported, renderEmpty, size],
  );

  return view === CollectibleView.Packup ? (
    <PackupList
      onSelectCollectible={onSelectCollectible}
      isLoading
      isSupported
      collectibles={collectibles}
      fetchData={fetchData}
      flatListProps={sharedProps}
      onPress={() => {
        setView(CollectibleView.Expand);
      }}
      {...props}
    />
  ) : (
    <ExpandList
      onSelectAsset={onSelectAsset}
      isLoading
      isSupported
      collectibles={collectibles}
      fetchData={fetchData}
      flatListProps={sharedProps}
      onPress={() => {
        setView(CollectibleView.Packup);
      }}
      {...props}
    />
  );
};

export default CollectibleGallery;

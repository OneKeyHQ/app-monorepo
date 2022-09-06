import React, { ComponentProps, FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  FlatList,
  HStack,
  IconButton,
  Typography,
  useIsVerticalLayout,
  useTheme,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { FlatListProps } from '@onekeyhq/components/src/FlatList';
import type { Collection, NFTAsset } from '@onekeyhq/engine/src/types/nft';
import IconNFT from '@onekeyhq/kit/assets/3d_nft.png';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import { FormatCurrencyNumber } from '../../../../components/Format';
import { MAX_PAGE_CONTAINER_WIDTH } from '../../../../config';
import { useNFTPrice } from '../../../../hooks/useTokens';
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
  const { themeVariant } = useTheme();
  const { account, network } = useActiveWalletAccount();

  const totalPrice = useNFTPrice({
    accountId: account?.address,
    networkId: network?.id,
  });

  const subDesc = intl.formatMessage({ id: 'form__last_price' });
  return (
    <Box flexDirection="column" paddingRight="16px">
      <Box
        flexDirection="row"
        height="84px"
        mb="24px"
        bgColor="surface-default"
        borderRadius="12px"
        borderColor="border-subdued"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        padding="16px"
        justifyContent="space-between"
      >
        <Box flexDirection="column">
          <Typography.DisplayLarge>
            <FormatCurrencyNumber decimals={2} value={totalPrice} />
          </Typography.DisplayLarge>
          <Typography.Body2 color="text-subdued">
            {intl.formatMessage(
              {
                id: 'content__total_value_by_str',
              },
              { 0: subDesc },
            )}
          </Typography.Body2>
        </Box>
        {/* <IconButton
          // onPress={showHomeBalanceSettings}
          size="sm"
          name="CogSolid"
          type="plain"
          mr={-2}
        /> */}
      </Box>
      <HStack
        space={4}
        alignItems="center"
        justifyContent="space-between"
        pb={3}
      >
        <Typography.Heading>
          {intl.formatMessage({ id: 'title__assets' })}
        </Typography.Heading>
        <IconButton
          name={expand ? 'PackupOutline' : 'ExpandOutline'}
          size="sm"
          circle
          type="plain"
          onPress={onPress}
        />
      </HStack>
    </Box>
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

const ExpandList: FC<
  CollectibleGalleryProps & { flatListProps: FlatListShareProps }
> = ({ price, collectibles, onSelectAsset, flatListProps }) => {
  const allAssets = useMemo(
    () => collectibles.map((collection) => collection.assets).flat(),
    [collectibles],
  );
  const renderAssetItem = React.useCallback<
    NonNullable<FlatListProps<NFTAsset>['renderItem']>
  >(
    ({ item }) => (
      <CollectibleCard
        price={price}
        key={stringAppend(item.contractAddress, item.tokenId)}
        marginRight="16px"
        asset={item}
        onSelectAsset={onSelectAsset}
      />
    ),
    [onSelectAsset, price],
  );

  return (
    <Tabs.FlatList<NFTAsset>
      {...flatListProps}
      data={allAssets}
      renderItem={renderAssetItem}
      keyExtractor={(item, index) => {
        if (item.contractAddress && item.tokenId) {
          return item.contractAddress + item.tokenId;
        }
        if (item.tokenAddress) {
          return item.tokenAddress;
        }
        return `NFTAsset ${index}`;
      }}
    />
  );
};

const PackupList: FC<
  CollectibleGalleryProps & { flatListProps: FlatListShareProps }
> = ({ price, collectibles, onSelectCollection, flatListProps }) => {
  const renderCollectionItem = React.useCallback<
    NonNullable<FlatListProps<Collection>['renderItem']>
  >(
    ({ item }) => (
      <CollectionCard
        price={price}
        collectible={item}
        mr="16px"
        onSelectCollection={onSelectCollection}
      />
    ),
    [onSelectCollection, price],
  );
  return (
    <Tabs.FlatList<Collection>
      {...flatListProps}
      data={collectibles}
      renderItem={renderCollectionItem}
      keyExtractor={(item, index) => {
        if (item.contractAddress) {
          return `Collection ${item.contractAddress}`;
        }
        if (item.contractName) {
          return `Collection ${item.contractName}`;
        }
        return `Collection ${index}`;
      }}
    />
  );
};

const CollectibleGallery: FC<CollectibleGalleryProps> = ({
  price,
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
          pr="16px"
          imageUrl={IconNFT}
          title={intl.formatMessage({ id: 'empty__not_supported' })}
          subTitle={intl.formatMessage({ id: 'empty__not_supported_desc' })}
        />
      );
    }
    return (
      <Empty
        pr="16px"
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
    }),
    [EmptyView, collectibles.length, expand, numColumns],
  );

  return expand ? (
    <ExpandList
      price={price}
      flatListProps={sharedProps}
      collectibles={collectibles}
      onSelectAsset={onSelectAsset}
    />
  ) : (
    <PackupList
      price={price}
      flatListProps={sharedProps}
      collectibles={collectibles}
      onSelectCollection={onSelectCollection}
    />
  );
};

export default CollectibleGallery;

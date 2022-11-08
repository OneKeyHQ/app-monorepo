import React, { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import { Box, Divider, FlatList, Text } from '@onekeyhq/components';
import { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import useFormatDate from '../../../../../hooks/useFormatDate';
import CollectionLogo from '../../../CollectionLogo';
import PriceText from '../../../PriceText';
import { useCollectionDetail } from '../../hook';
import EmptyView from '../../Stats/EmptyView';
import StatsItemCell from '../../Stats/StatsItemCell';
import { useLiveMintContext } from '../context';

const ListHeaderComponent = () => {
  const intl = useIntl();

  return (
    <Box>
      <StatsItemCell
        mb="8px"
        height="16px"
        leftComponent={
          <Text color="text-subdued" typography="Subheading">
            {intl.formatMessage({
              id: 'content__collection',
            })}
          </Text>
        }
        rightComponents={[
          <Text
            textAlign="right"
            numberOfLines={1}
            typography="Subheading"
            color="text-subdued"
          >
            {intl.formatMessage({
              id: 'content__price',
            })}
          </Text>,
          <Text
            textAlign="right"
            numberOfLines={1}
            typography="Subheading"
            color="text-subdued"
          >
            {intl.formatMessage({
              id: 'content__time',
            })}
          </Text>,
        ]}
      />
      <Divider />
    </Box>
  );
};

const Desktop = () => {
  const context = useLiveMintContext()?.context;
  const { formatDistance } = useFormatDate();
  const goToCollectionDetail = useCollectionDetail();

  const renderItem: ListRenderItem<NFTAsset> = useCallback(
    ({ item }) => (
      <StatsItemCell
        onPress={() => {
          goToCollectionDetail({
            contractAddress: item.contractAddress as string,
            networkId: context?.selectedNetwork?.id as string,
          });
        }}
        height="64px"
        title={item.collection.contractName}
        subTitle={item.tokenId ? `ID ${item.tokenId}` : ''}
        rightComponents={[
          <PriceText
            price={new BigNumber(item.mintPrice ?? '0')
              .decimalPlaces(2)
              .toString()}
            networkId={context?.selectedNetwork?.id}
            textAlign="right"
            numberOfLines={1}
            typography="Body1"
          />,
          <Text textAlign="right" numberOfLines={1} typography="Body1Strong">
            {item.mintTimestamp ? formatDistance(item.mintTimestamp) : ''}
          </Text>,
        ]}
        logoComponent={
          <CollectionLogo
            src={item.collection.logoUrl}
            width="40px"
            height="40px"
          />
        }
      />
    ),
    [context?.selectedNetwork?.id, formatDistance, goToCollectionDetail],
  );

  if (
    context?.liveMintList === undefined ||
    context?.liveMintList?.length === 0 ||
    context.loading
  ) {
    return (
      <EmptyView
        ListHeaderComponent={ListHeaderComponent}
        isTab={context?.isTab}
        numberOfData={context?.isTab ? 5 : 10}
      />
    );
  }

  return (
    <FlatList
      ListHeaderComponent={ListHeaderComponent}
      data={context?.liveMintList}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <Divider />}
      keyExtractor={(item) =>
        `${item.contractAddress as string}${item.tokenId as string}`
      }
    />
  );
};
export default Desktop;

import React, { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { ListRenderItem } from 'react-native';

import { Box, FlatList, Text } from '@onekeyhq/components';
import { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import useFormatDate from '../../../../../hooks/useFormatDate';
import CollectionLogo from '../../../CollectionLogo';
import PriceText from '../../../PriceText';
import { useCollectionDetail } from '../../hook';
import EmptyView from '../../Stats/EmptyView';
import StatsItemCell from '../../Stats/StatsItemCell';
import { useLiveMintContext } from '../context';

const Mobile = () => {
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
        height="56px"
        paddingX="16px"
        title={item.collection.contractName}
        subTitle={item.tokenId ? `ID ${item.tokenId}` : ''}
        logoComponent={
          <CollectionLogo
            src={item.collection.logoUrl}
            width="56px"
            height="56px"
          />
        }
        rightComponents={[
          <Box flexDirection="column">
            <PriceText
              price={new BigNumber(item.mintPrice ?? '0')
                .decimalPlaces(2)
                .toString()}
              networkId={context?.selectedNetwork?.id}
              textAlign="right"
              numberOfLines={1}
              typography="Body1Strong"
            />
            <Text
              textAlign="right"
              numberOfLines={1}
              typography="Body2"
              color="text-subdued"
            >
              {item.mintTimestamp ? formatDistance(item.mintTimestamp) : ''}
            </Text>
          </Box>,
        ]}
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
        isTab={context?.isTab}
        numberOfData={context?.isTab ? 5 : 10}
      />
    );
  }

  return (
    <FlatList
      data={context?.liveMintList}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <Box height="20px" />}
      keyExtractor={(item) =>
        `${item.contractAddress as string}${item.tokenId as string}`
      }
    />
  );
};
export default Mobile;

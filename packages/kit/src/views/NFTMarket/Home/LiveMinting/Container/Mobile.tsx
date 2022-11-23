import React, { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { MotiView } from 'moti';
import { ListRenderItem } from 'react-native';

import { Box, List, ListItem } from '@onekeyhq/components';
import { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import useFormatDate from '../../../../../hooks/useFormatDate';
import CollectionLogo from '../../../CollectionLogo';
import { PriceString } from '../../../PriceText';
import { useCollectionDetail } from '../../hook';
import EmptyView from '../../Stats/EmptyView';
import { useLiveMintContext } from '../context';

const Mobile = () => {
  const context = useLiveMintContext()?.context;
  const { formatDistance } = useFormatDate();
  const goToCollectionDetail = useCollectionDetail();

  const renderItem: ListRenderItem<NFTAsset> = useCallback(
    ({ item }) => (
      <>
        <ListItem
          onPress={() => {
            goToCollectionDetail({
              contractAddress: item.contractAddress as string,
              networkId: context?.selectedNetwork?.id as string,
              title: item.contractName,
            });
          }}
        >
          <ListItem.Column>
            <CollectionLogo
              src={item.collection.logoUrl}
              width="56px"
              height="56px"
              verified={item.collection.openseaVerified}
            />
          </ListItem.Column>
          <ListItem.Column
            flex={1}
            text={{
              label: item.collection.contractName,
              labelProps: { isTruncated: true },
              description: item.tokenId ? `ID ${item.tokenId}` : '–',
              descriptionProps: { numberOfLines: 1 },
            }}
          />
          <ListItem.Column
            text={{
              label: PriceString({
                price: new BigNumber(item.mintPrice ?? '0')
                  .decimalPlaces(6)
                  .toString(),
                networkId: context?.selectedNetwork?.id,
              }),
              labelProps: { textAlign: 'right', numberOfLines: 1 },
              description: item.mintTimestamp
                ? formatDistance(item.mintTimestamp)
                : '–',
              descriptionProps: {
                textAlign: 'right',
                numberOfLines: 1,
              },
            }}
          />
        </ListItem>
      </>
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
    <MotiView
      style={{ flex: 1 }}
      from={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
    >
      <List
        data={context?.liveMintList}
        renderItem={renderItem}
        keyExtractor={(item) =>
          `${item.contractAddress as string}${item.tokenId as string}`
        }
        ItemSeparatorComponent={() => <Box h="4px" />}
      />
    </MotiView>
  );
};
export default Mobile;

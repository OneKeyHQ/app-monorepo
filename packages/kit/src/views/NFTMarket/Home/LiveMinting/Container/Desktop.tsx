import React, { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import { List, ListItem } from '@onekeyhq/components';
import { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import useFormatDate from '../../../../../hooks/useFormatDate';
import CollectionLogo from '../../../CollectionLogo';
import { PriceString } from '../../../PriceText';
import { useCollectionDetail } from '../../hook';
import EmptyView from '../../Stats/EmptyView';
import { useLiveMintContext } from '../context';

const ListHeaderComponent = () => {
  const intl = useIntl();

  return (
    <>
      <ListItem>
        <ListItem.Column
          flex={1}
          text={{
            label: intl.formatMessage({
              id: 'content__collection',
            }),
            labelProps: {
              typography: 'Subheading',
              color: 'text-subdued',
            },
          }}
        />
        <ListItem.Column
          w="160px"
          text={{
            label: intl.formatMessage({
              id: 'content__price',
            }),
            labelProps: {
              typography: 'Subheading',
              color: 'text-subdued',
              textAlign: 'right',
            },
          }}
        />
        <ListItem.Column
          w="332px"
          text={{
            label: intl.formatMessage({
              id: 'content__time',
            }),
            labelProps: {
              typography: 'Subheading',
              color: 'text-subdued',
              textAlign: 'right',
            },
          }}
        />
      </ListItem>
    </>
  );
};

const Desktop = () => {
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
            });
          }}
        >
          <ListItem.Column>
            <CollectionLogo
              src={item.collection.logoUrl}
              width="40px"
              height="40px"
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
            w="160px"
            text={{
              label: PriceString({
                price: new BigNumber(item.mintPrice ?? '0')
                  .decimalPlaces(2)
                  .toString(),
                networkId: context?.selectedNetwork?.id,
              }),
              labelProps: { textAlign: 'right' },
            }}
          />
          <ListItem.Column
            w="332"
            text={{
              label: item.mintTimestamp
                ? formatDistance(item.mintTimestamp)
                : '_',
              labelProps: { textAlign: 'right' },
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
        ListHeaderComponent={() => ListHeaderComponent()}
        isTab={context?.isTab}
        numberOfData={context?.isTab ? 5 : 10}
      />
    );
  }

  return (
    <MotiView from={{ opacity: 0.5 }} animate={{ opacity: 1 }}>
      <List
        ListHeaderComponent={() => ListHeaderComponent()}
        data={context?.liveMintList}
        renderItem={renderItem}
        keyExtractor={(item) =>
          `${item.contractAddress as string}${item.tokenId as string}`
        }
      />
    </MotiView>
  );
};
export default Desktop;

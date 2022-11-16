import React, { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { MotiView } from 'moti';
import { Row } from 'native-base';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import { Box, List, ListItem } from '@onekeyhq/components';
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
          flex={3}
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
          flex={1}
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
          flex={2}
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
      <Box mx="8px" borderBottomWidth={1} borderColor="divider" />
    </>
  );
};

const Desktop = () => {
  const context = useLiveMintContext()?.context;
  const { formatDistance } = useFormatDate();
  const goToCollectionDetail = useCollectionDetail();

  const renderItem: ListRenderItem<NFTAsset> = useCallback(
    ({ item }) => (
      <ListItem
        onPress={() => {
          goToCollectionDetail({
            contractAddress: item.contractAddress as string,
            networkId: context?.selectedNetwork?.id as string,
            title: item.contractName,
          });
        }}
      >
        <Row flex={3} space="12px" alignItems="center">
          <CollectionLogo
            src={item.collection.logoUrl}
            width="40px"
            height="40px"
          />
          <ListItem.Column
            flex={1}
            text={{
              label: item.collection.contractName,
              labelProps: { isTruncated: true },
              description: item.tokenId ? `ID ${item.tokenId}` : '–',
              descriptionProps: { numberOfLines: 1 },
            }}
          />
        </Row>

        <ListItem.Column
          flex={1}
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
          flex={2}
          text={{
            label: item.mintTimestamp
              ? formatDistance(item.mintTimestamp)
              : '_',
            labelProps: { textAlign: 'right' },
          }}
        />
      </ListItem>
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
        showDivider
        keyExtractor={(item) =>
          `${item.contractAddress as string}${item.tokenId as string}`
        }
      />
    </MotiView>
  );
};
export default Desktop;

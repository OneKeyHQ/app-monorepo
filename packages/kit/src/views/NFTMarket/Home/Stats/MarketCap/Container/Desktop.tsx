import React, { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import { List, ListItem } from '@onekeyhq/components';
import { NFTMarketCapCollection } from '@onekeyhq/engine/src/types/nft';

import { formatMarketValueForComma } from '../../../../../Market/utils';
import CollectionLogo from '../../../../CollectionLogo';
import { PriceString } from '../../../../PriceText';
import { useCollectionDetail } from '../../../hook';
import { useStatsListContext } from '../../context';
import EmptyView from '../../EmptyView';

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
              id: 'content__market_cap',
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

const Desktop = ({ listData }: { listData: NFTMarketCapCollection[] }) => {
  const context = useStatsListContext()?.context;
  const intl = useIntl();
  const goToCollectionDetail = useCollectionDetail();

  const renderItem: ListRenderItem<NFTMarketCapCollection> = useCallback(
    ({ item, index }) => (
      <>
        <ListItem
          onPress={() => {
            goToCollectionDetail({
              contractAddress: item.contract_address as string,
              networkId: context?.selectedNetwork?.id as string,
            });
          }}
        >
          <ListItem.Column>
            <CollectionLogo src={item.logo_url} width="40px" height="40px" />
          </ListItem.Column>
          <ListItem.Column
            text={{
              label: `${index + 1}`,
              labelProps: { pb: '24px', typography: 'Body1' },
            }}
          />
          <ListItem.Column
            flex={1}
            text={{
              label: item.contract_name,
              labelProps: { isTruncated: true },
              description: PriceString({
                prefix: intl.formatMessage({
                  id: 'content__floor',
                }),
                price: item.floor_price,
                networkId: context?.selectedNetwork?.id,
              }),
              descriptionProps: { numberOfLines: 1 },
            }}
          />
          <ListItem.Column
            w="160px"
            text={{
              label: PriceString({
                price: formatMarketValueForComma(
                  new BigNumber(item.market_cap ?? '0')
                    .decimalPlaces(2)
                    .toNumber(),
                ),
                networkId: context?.selectedNetwork?.id,
              }),
              labelProps: { textAlign: 'right' },
            }}
          />
        </ListItem>
      </>
    ),
    [context?.selectedNetwork?.id, goToCollectionDetail, intl],
  );

  if (listData === undefined || listData?.length === 0 || context?.loading) {
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
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item, index) =>
          `${item.contract_address as string}${index}`
        }
      />
    </MotiView>
  );
};
export default Desktop;

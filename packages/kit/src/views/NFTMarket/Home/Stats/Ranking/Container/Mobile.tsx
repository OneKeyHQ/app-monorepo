import React, { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import { List, ListItem } from '@onekeyhq/components';
import { NFTMarketRanking } from '@onekeyhq/engine/src/types/nft';

import CollectionLogo from '../../../../CollectionLogo';
import { PriceString } from '../../../../PriceText';
import { useCollectionDetail } from '../../../hook';
import { useStatsListContext } from '../../context';
import EmptyView from '../../EmptyView';

const Mobile = ({ listData }: { listData: NFTMarketRanking[] }) => {
  const context = useStatsListContext()?.context;
  const intl = useIntl();
  const goToCollectionDetail = useCollectionDetail();

  const renderItem: ListRenderItem<NFTMarketRanking> = useCallback(
    ({ item, index }) => (
      <ListItem
        onPress={() => {
          goToCollectionDetail({
            contractAddress: item.contract_address as string,
            networkId: context?.selectedNetwork?.id as string,
          });
        }}
      >
        <ListItem.Column>
          <CollectionLogo src={item.logo_url} width="56px" height="56px" />
        </ListItem.Column>
        <ListItem.Column
          text={{
            label: `${index + 1}`,
            labelProps: { pb: '24px', typography: 'Body1Mono' },
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
          text={{
            label: PriceString({
              price: new BigNumber(item.volume ?? '0')
                .decimalPlaces(2)
                .toString(),
              networkId: context?.selectedNetwork?.id,
            }),
            labelProps: { textAlign: 'right', mb: '24px', numberOfLines: 1 },
          }}
        />
      </ListItem>
    ),
    [context?.selectedNetwork?.id, goToCollectionDetail, intl],
  );

  if (listData === undefined || listData?.length === 0 || context?.loading) {
    return (
      <EmptyView
        isTab={context?.isTab}
        numberOfData={context?.isTab ? 5 : 10}
      />
    );
  }
  return (
    <MotiView from={{ opacity: 0.5 }} animate={{ opacity: 1 }}>
      <List
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item, index) =>
          `${item.contract_address as string}${index}`
        }
      />
    </MotiView>
  );
};
export default Mobile;

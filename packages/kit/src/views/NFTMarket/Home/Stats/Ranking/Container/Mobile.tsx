import React, { ComponentProps, FC, useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import { List, ListItem } from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import { NFTMarketRanking } from '@onekeyhq/engine/src/types/nft';

import CollectionLogo from '../../../../CollectionLogo';
import { PriceString } from '../../../../PriceText';
import { useCollectionDetail } from '../../../hook';
import { useStatsListContext } from '../../context';
import EmptyView from '../../EmptyView';

type Props = { listData: NFTMarketRanking[]; selectNetwork?: Network } & Pick<
  ComponentProps<typeof List>,
  'ListHeaderComponent' | 'ListFooterComponent'
>;

const Mobile: FC<Props> = ({ selectNetwork, listData, ...listProps }) => {
  const context = useStatsListContext()?.context;
  const intl = useIntl();
  const goToCollectionDetail = useCollectionDetail();
  const network = context?.selectedNetwork ?? selectNetwork;

  const renderItem: ListRenderItem<NFTMarketRanking> = useCallback(
    ({ item, index }) => (
      <ListItem
        onPress={() => {
          goToCollectionDetail({
            contractAddress: item.contract_address as string,
            networkId: network?.id as string,
          });
        }}
      >
        <ListItem.Column>
          <CollectionLogo src={item.logo_url} width="56px" height="56px" />
        </ListItem.Column>
        <ListItem.Column
          text={{
            label: `${index + 1}`,
            labelProps: { pb: '24px', typography: 'Body1Strong' },
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
              networkId: network?.id,
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
              networkId: network?.id,
            }),
            labelProps: { textAlign: 'right', mb: '24px', numberOfLines: 1 },
          }}
        />
      </ListItem>
    ),
    [network?.id, goToCollectionDetail, intl],
  );

  if (listData === undefined || listData?.length === 0 || context?.loading) {
    return (
      <EmptyView
        isTab={context?.isTab}
        numberOfData={context?.isTab ? 5 : 10}
        ListHeaderComponent={listProps.ListHeaderComponent}
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
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item, index) =>
          `${item.contract_address as string}${index}`
        }
        {...listProps}
      />
    </MotiView>
  );
};
export default Mobile;

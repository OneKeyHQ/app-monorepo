import React, { useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import { Box, Divider, FlatList, Text } from '@onekeyhq/components';
import { NFTMarketRanking } from '@onekeyhq/engine/src/types/nft';

import CollectionLogo from '../../../../CollectionLogo';
import PriceText, { PriceString } from '../../../../PriceText';
import { useCollectionDetail } from '../../../hook';
import { useStatsListContext } from '../../context';
import EmptyView from '../../EmptyView';
import StatsItemCell from '../../StatsItemCell';

const ListHeaderComponent = () => {
  const intl = useIntl();
  const context = useStatsListContext()?.context;

  const saleTitle = useMemo(() => {
    switch (context?.selectedTime) {
      case 0:
        return intl.formatMessage(
          {
            id: 'content__int_hours_sales',
          },
          { 0: 6 },
        );
      case 1:
        return intl.formatMessage(
          {
            id: 'content__int_hours_sales',
          },
          { 0: 12 },
        );
      case 2:
        return intl.formatMessage(
          {
            id: 'content__int_day_sales',
          },
          { 0: 1 },
        );
      default:
        break;
    }
  }, [context?.selectedTime, intl]);

  const volumeTitle = useMemo(() => {
    switch (context?.selectedTime) {
      case 0:
        return intl.formatMessage(
          {
            id: 'content__int_hours_volume',
          },
          { 0: 6 },
        );
      case 1:
        return intl.formatMessage(
          {
            id: 'content__int_hours_volume',
          },
          { 0: 12 },
        );
      case 2:
        return intl.formatMessage(
          {
            id: 'content__int_day_volume',
          },
          { 0: 1 },
        );
      default:
        break;
    }
  }, [context?.selectedTime, intl]);

  return (
    <Box flexDirection="column">
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
              id: 'content__uique_owner',
            })}
          </Text>,
          // <Text
          //   textAlign="right"
          //   numberOfLines={1}
          //   typography="Subheading"
          //   color="text-subdued"
          // >
          //   {intl.formatMessage({
          //     id: 'content__blue_chip_rates',
          //   })}
          // </Text>,
          <Text
            textAlign="right"
            numberOfLines={1}
            typography="Subheading"
            color="text-subdued"
          >
            {saleTitle}
          </Text>,
          <Text
            textAlign="right"
            numberOfLines={1}
            typography="Subheading"
            color="text-subdued"
          >
            {volumeTitle}
          </Text>,
        ]}
      />
      <Divider />
    </Box>
  );
};

const Desktop = ({ listData }: { listData: NFTMarketRanking[] }) => {
  const context = useStatsListContext()?.context;
  const intl = useIntl();
  const goToCollectionDetail = useCollectionDetail();

  const renderItem: ListRenderItem<NFTMarketRanking> = useCallback(
    ({ item, index }) => {
      const uniqueOwner =
        ((item.owners_total ?? 0) / (item.items_total ?? 0)) * 100;

      return (
        <StatsItemCell
          onPress={() => {
            goToCollectionDetail({
              contractAddress: item.contract_address as string,
              networkId: context?.selectedNetwork?.id as string,
            });
          }}
          height="64px"
          index={`${index + 1}`}
          title={item.contract_name}
          subTitle={PriceString({
            prefix: intl.formatMessage({
              id: 'content__floor',
            }),
            price: item.floor_price,
            networkId: context?.selectedNetwork?.id,
          })}
          rightComponents={[
            <Text textAlign="right" numberOfLines={1} typography="Body1">
              {uniqueOwner <= 100
                ? `${new BigNumber(uniqueOwner ?? '0')
                    .decimalPlaces(2)
                    .toString()}%`
                : ''}
            </Text>,
            // <Text textAlign="right" numberOfLines={1} typography="Body1">
            //   {item.}
            // </Text>,
            <Text textAlign="right" numberOfLines={1} typography="Body1">
              {item.sales}
            </Text>,
            <PriceText
              price={new BigNumber(item.volume ?? '0')
                .decimalPlaces(2)
                .toString()}
              networkId={context?.selectedNetwork?.id}
              textAlign="right"
              numberOfLines={1}
              typography="Body1Strong"
            />,
          ]}
          logoComponent={
            <CollectionLogo src={item.logo_url} width="40px" height="40px" />
          }
        />
      );
    },
    [context?.selectedNetwork?.id, goToCollectionDetail, intl],
  );

  if (listData === undefined || listData?.length === 0 || context?.loading) {
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
      data={listData}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <Divider />}
      keyExtractor={(item, index) =>
        `${item.contract_address as string}${index}`
      }
    />
  );
};
export default Desktop;

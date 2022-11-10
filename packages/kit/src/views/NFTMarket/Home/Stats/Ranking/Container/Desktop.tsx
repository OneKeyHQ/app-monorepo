import React, { useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import { Box, List, ListItem, useUserDevice } from '@onekeyhq/components';
import { NFTMarketRanking } from '@onekeyhq/engine/src/types/nft';

import CollectionLogo from '../../../../CollectionLogo';
import { PriceString } from '../../../../PriceText';
import { useCollectionDetail } from '../../../hook';
import { useStatsListContext } from '../../context';
import EmptyView from '../../EmptyView';

const ListHeaderComponent = () => {
  const intl = useIntl();
  const context = useStatsListContext()?.context;
  const { screenWidth } = useUserDevice();
  const pageWidth = screenWidth - 224;
  const hideSaleItem = pageWidth < 900;

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
    <>
      <ListItem>
        <ListItem.Column
          p={2}
          flex={1.9}
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
              id: 'content__uique_owner',
            }),
            labelProps: {
              typography: 'Subheading',
              color: 'text-subdued',
              textAlign: 'right',
            },
          }}
        />
        <ListItem.Column
          flex={1}
          text={{
            label: intl.formatMessage({
              id: 'content__blue_chip_rates',
            }),
            labelProps: {
              typography: 'Subheading',
              color: 'text-subdued',
              textAlign: 'right',
            },
          }}
        />
        {!hideSaleItem && (
          <ListItem.Column
            flex={1}
            text={{
              label: saleTitle,
              labelProps: {
                typography: 'Subheading',
                color: 'text-subdued',
                textAlign: 'right',
              },
            }}
          />
        )}

        <ListItem.Column
          flex={1}
          text={{
            label: volumeTitle,
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

const Desktop = ({ listData }: { listData: NFTMarketRanking[] }) => {
  const context = useStatsListContext()?.context;
  const intl = useIntl();
  const goToCollectionDetail = useCollectionDetail();
  const { screenWidth } = useUserDevice();
  const pageWidth = screenWidth - 224;
  const hideSaleItem = pageWidth < 900;

  const renderItem: ListRenderItem<NFTMarketRanking> = useCallback(
    ({ item, index }) => {
      const uniqueOwner =
        ((item.owners_total ?? 0) / (item.items_total ?? 0)) * 100;

      return (
        <>
          <ListItem
            onPress={() => {
              goToCollectionDetail({
                contractAddress: item.contract_address as string,
                networkId: context?.selectedNetwork?.id as string,
                title: item.contract_name,
              });
            }}
          >
            <ListItem flex={1.9}>
              <CollectionLogo src={item.logo_url} width="40px" height="40px" />
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
            </ListItem>

            <ListItem.Column
              flex={1}
              text={{
                label:
                  uniqueOwner <= 100
                    ? `${new BigNumber(uniqueOwner ?? '0')
                        .decimalPlaces(2)
                        .toString()}%`
                    : '',
                labelProps: { textAlign: 'right' },
              }}
            />
            <ListItem.Column
              flex={1}
              text={{
                label: item.blueChip?.next_blue_chip_probability ?? '-',
                labelProps: { textAlign: 'right' },
              }}
            />
            {!hideSaleItem && (
              <ListItem.Column
                flex={1}
                text={{
                  label: item.sales,
                  labelProps: { textAlign: 'right' },
                }}
              />
            )}
            <ListItem.Column
              flex={1}
              text={{
                label: PriceString({
                  price: new BigNumber(item.volume ?? '0')
                    .decimalPlaces(2)
                    .toString(),
                  networkId: context?.selectedNetwork?.id,
                }),
                labelProps: { textAlign: 'right' },
              }}
            />
          </ListItem>
        </>
      );
    },
    [context?.selectedNetwork?.id, goToCollectionDetail, hideSaleItem, intl],
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
        showDivider
        renderItem={renderItem}
        keyExtractor={(item, index) =>
          `${item.contract_address as string}${index}`
        }
      />
    </MotiView>
  );
};
export default Desktop;

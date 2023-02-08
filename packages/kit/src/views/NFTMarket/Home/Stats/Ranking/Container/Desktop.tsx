import { useCallback, useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { MotiView } from 'moti';
import { Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  List,
  ListItem,
  useUserDevice,
} from '@onekeyhq/components';
import type { NFTMarketRanking } from '@onekeyhq/engine/src/types/nft';

import CollectionLogo from '../../../../CollectionLogo';
import { PriceString } from '../../../../PriceText';
import { useCollectionDetail } from '../../../hook';
import { useStatsListContext } from '../../context';
import EmptyView from '../../EmptyView';

import type { ListRenderItem } from 'react-native';

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
          p={0}
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

      const volumeChange = item.volume_change ?? '-';
      let volumeChangeBgColor;
      let volumeTextColor;
      if (item?.volume_change?.startsWith('-')) {
        //-
        volumeChangeBgColor = 'surface-critical-subdued';
        volumeTextColor = 'text-critical';
      } else if (!item?.volume_change?.startsWith('0.00%')) {
        //+
        volumeChangeBgColor = 'surface-success-subdued';
        volumeTextColor = 'text-success';
      } else {
        // 0
        volumeTextColor = 'text-subdued';
      }

      return (
        <ListItem
          onPress={() => {
            goToCollectionDetail({
              contractAddress: item.contract_address as string,
              networkId: context?.selectedNetwork?.id as string,
              title: item.contract_name,
            });
          }}
        >
          <Row flex={1.9} space="12px" alignItems="center">
            <CollectionLogo
              src={item.logo_url}
              width="40px"
              height="40px"
              verified={item.openseaVerified}
            />
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
          </Row>

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
            space="2px"
            flex={1}
            text={{
              label: PriceString({
                price: new BigNumber(item.volume ?? '0')
                  .decimalPlaces(2)
                  .toString(),
                networkId: context?.selectedNetwork?.id,
              }),
              labelProps: { textAlign: 'right' },
              description: (
                <Box
                  justifyContent="flex-end"
                  flex={1}
                  width="full"
                  flexDirection="row"
                >
                  <Badge
                    size="sm"
                    bgColor={volumeChangeBgColor}
                    title={volumeChange}
                    color={volumeTextColor}
                  />
                </Box>
              ),
            }}
          />
        </ListItem>
      );
    },
    [context?.selectedNetwork?.id, goToCollectionDetail, hideSaleItem, intl],
  );
  const ListHeader = useCallback(() => <ListHeaderComponent />, []);

  if (listData === undefined || listData?.length === 0 || context?.loading) {
    return (
      <EmptyView
        ListHeaderComponent={ListHeader}
        isTab={context?.isTab}
        numberOfData={context?.isTab ? 5 : 10}
      />
    );
  }

  return (
    <MotiView from={{ opacity: 0.5 }} animate={{ opacity: 1 }}>
      <List
        ListHeaderComponent={ListHeader}
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

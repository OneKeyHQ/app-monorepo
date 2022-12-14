import React, { FC, useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { Column, Row } from 'native-base';
import { ListRenderItem } from 'react-native';

import {
  Badge,
  Box,
  CustomSkeleton,
  Icon,
  List,
  ListItem,
  Skeleton,
  Text,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import { NFTAsset, NFTNPL } from '@onekeyhq/engine/src/types/nft';

import useFormatDate from '../../../../../hooks/useFormatDate';
import NFTListImage from '../../../../Wallet/NFT/NFTList/NFTListImage';
import { PriceString } from '../../../PriceText';

type ListProps = {
  data: NFTNPL[];
  ListHeaderComponent?: () => JSX.Element;
  loading?: boolean;
  network: Network;
};

const Footer: FC = () => (
  <Box>
    {[1, 2, 3, 4, 5].map((item) => (
      <Box>
        <ListItem px={0} py={0} my={0} key={`Skeleton${item}`}>
          <Row flex={304} space="12px" alignItems="center">
            <CustomSkeleton width="40px" height="40px" borderRadius="12px" />
            <ListItem.Column
              flex={1}
              text={{
                label: <Skeleton shape="Body1" />,
                description: <Skeleton shape="Body2" />,
              }}
            />
          </Row>
          <ListItem.Column
            flex={180}
            text={{
              label: <Skeleton shape="Body1" />,
              description: <Skeleton shape="Body2" />,
            }}
          />
          <ListItem.Column
            flex={180}
            text={{
              label: <Skeleton shape="Body1" />,
              description: <Skeleton shape="Body2" />,
            }}
          />
          <ListItem.Column
            alignItems="flex-end"
            flex={140}
            text={{
              label: <Skeleton shape="Body1" />,
            }}
          />
          <ListItem.Column
            alignItems="flex-end"
            flex={140}
            text={{
              label: <Skeleton shape="Body1" />,
            }}
          />
        </ListItem>
        <Box my="8px" height="1px" bgColor="divider" />
      </Box>
    ))}
  </Box>
);

const Desktop: FC<ListProps> = ({ network, loading, ...props }) => {
  const { formatDistanceStrict } = useFormatDate();
  const renderItem: ListRenderItem<NFTNPL> = useCallback(
    ({ item }) => {
      const { asset, entry, exit, profit } = item;

      let entryBadge;
      if (entry.eventType === 'Mint') {
        entryBadge = 'Mint';
      } else if (entry.eventType === 'Transfer') {
        entryBadge = 'Receive';
      }

      const exitValue = (exit.tradePrice ?? 0) - (exit.gasFee ?? 0);
      return (
        <ListItem
          px={0}
          py={0}
          my={0}
          onPress={() => {
            console.log('item = ', item);
          }}
        >
          <Row flex={304} space="12px" alignItems="center">
            {item.asset && (
              <NFTListImage
                asset={asset as NFTAsset}
                borderRadius="12px"
                size={40}
              />
            )}
            <ListItem.Column
              flex={1}
              text={{
                label: item.contractName,
                labelProps: { typography: 'Body1Strong', numberOfLines: 1 },
                description: item.tokenId ? `#${item.tokenId}` : '–',
                descriptionProps: {
                  numberOfLines: 1,
                  typography: 'Body2',
                  color: 'text-subdued',
                },
              }}
            />
          </Row>

          <Column space="4px" flex={180}>
            <Row space="4px" alignItems="center">
              <Text typography="Body1Strong" numberOfLines={1}>
                {PriceString({
                  price: new BigNumber(entry?.tradePrice ?? 0)
                    .decimalPlaces(3)
                    .toString(),
                  symbol: entry.tradeSymbol,
                })}
              </Text>
              {entryBadge && (
                <Badge type="default" size="sm" title={entryBadge} />
              )}
            </Row>
            <Row space="4px" alignItems="center">
              <Icon name="GasIllus" size={16} color="icon-subdued" />
              <Text typography="Body2" numberOfLines={1} color="text-subdued">
                {PriceString({
                  price: new BigNumber(entry.gasFee ?? 0)
                    .decimalPlaces(3)
                    .toString(),
                  networkId: network.id,
                })}
              </Text>
            </Row>
          </Column>

          <Column space="4px" flex={180}>
            <Text typography="Body1Strong" numberOfLines={1}>
              {PriceString({
                price: new BigNumber(exitValue).decimalPlaces(3).toString(),
                symbol: exit.tradeSymbol,
              })}
            </Text>
            <Row space="4px" alignItems="center">
              <Icon name="GasIllus" size={16} color="icon-subdued" />
              <Text typography="Body2" numberOfLines={1} color="text-subdued">
                {PriceString({
                  price: new BigNumber(exit.gasFee ?? 0)
                    .decimalPlaces(3)
                    .toString(),
                  networkId: network.id,
                })}
              </Text>
            </Row>
          </Column>

          <ListItem.Column
            flex={140}
            text={{
              label: PriceString({
                price: new BigNumber(profit).decimalPlaces(3).toString(),
                symbol: item.exit.tradeSymbol,
              }),
              labelProps: {
                isTruncated: true,
                textAlign: 'right',
                numberOfLines: 1,
                color: profit > 0 ? 'text-success' : 'text-critical',
              },
            }}
          />
          <ListItem.Column
            flex={140}
            text={{
              label: formatDistanceStrict(exit.timestamp, entry.timestamp),
              labelProps: {
                typography: 'Body1Strong',
                textAlign: 'right',
              },
            }}
          />
        </ListItem>
      );
    },
    [formatDistanceStrict, network.id],
  );

  return (
    <Box flex={1}>
      <List
        m={0}
        renderItem={renderItem}
        keyExtractor={(item) => (item.contractAddress as string) + item.tokenId}
        p={{ base: '16px', md: '32px' }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <Box my="8px" height="1px" bgColor="divider" />
        )}
        ListFooterComponent={() => {
          if (loading) {
            return <Footer />;
          }
          return null;
        }}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 992,
          alignSelf: 'center',
        }}
        {...props}
      />
    </Box>
  );
};

export default Desktop;

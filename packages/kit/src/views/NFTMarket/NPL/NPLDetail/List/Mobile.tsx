import React, { FC, useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { ListRenderItem } from 'react-native';

import {
  Box,
  CustomSkeleton,
  List,
  ListItem,
  Skeleton,
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
  <Box mt="8px">
    {[1, 2, 3, 4, 5].map((item) => (
      <ListItem key={`Skeleton${item}`} px={0} py={0} my={0} mb="16px">
        <ListItem.Column>
          <CustomSkeleton width="40px" height="40px" borderRadius="12px" />
        </ListItem.Column>
        <ListItem.Column
          flex={1}
          text={{
            label: <Skeleton shape="Body1" />,
            description: <Skeleton shape="Body2" />,
          }}
        />
        <ListItem.Column
          alignItems="flex-end"
          flex={1}
          text={{
            label: <Skeleton shape="Body1" />,
            description: <Skeleton shape="Body2" />,
          }}
        />
      </ListItem>
    ))}
  </Box>
);
const Mobile: FC<ListProps> = ({ network, loading, ...props }) => {
  const { formatDistanceStrict } = useFormatDate();
  const renderItem: ListRenderItem<NFTNPL> = useCallback(
    ({ item }) => {
      const { asset, entry, exit } = item;
      const profit = (exit?.tradePrice ?? 0) - (entry?.tradePrice ?? 0);

      return (
        <ListItem
          px={0}
          py="8px"
          my={0}
          onPress={() => {
            console.log('item = ', item);
          }}
        >
          <ListItem.Column>
            <NFTListImage
              asset={asset as NFTAsset}
              borderRadius="12px"
              size={40}
            />
          </ListItem.Column>
          <ListItem.Column
            flex={2}
            text={{
              label: item.contractName,
              labelProps: { typography: 'Body1Strong', isTruncated: true },
              description: item.tokenId ? `#${item.tokenId}` : '–',
              descriptionProps: { numberOfLines: 1 },
            }}
          />
          <ListItem.Column
            flex={1}
            text={{
              label: PriceString({
                price: new BigNumber(profit).decimalPlaces(3).toString(),
                symbol: item.exit.tradeSymbol,
              }),
              labelProps: {
                textAlign: 'right',
                numberOfLines: 1,
                color: profit > 0 ? 'text-success' : 'text-critical',
              },
              description: formatDistanceStrict(
                exit.timestamp,
                entry.timestamp,
              ),
              descriptionProps: { numberOfLines: 1, textAlign: 'right' },
            }}
          />
        </ListItem>
      );
    },
    [formatDistanceStrict],
  );

  return (
    <Box flex={1}>
      <List
        m={0}
        renderItem={renderItem}
        keyExtractor={(item) => (item.contractAddress as string) + item.tokenId}
        p={{ base: '16px', md: '32px' }}
        showsVerticalScrollIndicator={false}
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

export default Mobile;

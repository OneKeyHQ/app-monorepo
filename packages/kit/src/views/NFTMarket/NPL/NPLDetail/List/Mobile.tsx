import type { FC } from 'react';
import { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';

import {
  Box,
  CustomSkeleton,
  List,
  ListItem,
  Skeleton,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { NFTAsset, NFTNPL } from '@onekeyhq/engine/src/types/nft';

import useFormatDate from '../../../../../hooks/useFormatDate';
import NFTListImage from '../../../../Wallet/NFT/NFTList/NFTListImage';
import { PriceString } from '../../../PriceText';

import type { ListRenderItem } from 'react-native';

type ListProps = {
  data: NFTNPL[];
  ListHeaderComponent?: () => JSX.Element;
  loading?: boolean;
  network: Network;
};

const Footer: FC = () => (
  <>
    {[1, 2, 3, 4, 5].map((item) => (
      <ListItem key={`Skeleton${item}`}>
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
  </>
);
const Mobile: FC<ListProps> = ({ network, loading, ...props }) => {
  const { formatDistanceStrict } = useFormatDate();
  const renderItem: ListRenderItem<NFTNPL> = useCallback(
    ({ item }) => {
      const { asset, entry, exit, profit } = item;

      let profitLab = PriceString({
        price: new BigNumber(profit).decimalPlaces(3).toString(),
        symbol: item.exit.tradeSymbol,
      });
      profitLab = `${profit >= 0 ? '+' : ''}${profitLab}`;

      return (
        <ListItem>
          <ListItem.Column>
            <NFTListImage
              asset={asset as NFTAsset}
              borderRadius="12px"
              size={40}
            />
          </ListItem.Column>
          <ListItem.Column
            flex={1}
            text={{
              label: item.contractName,
              labelProps: { typography: 'Body1Strong', isTruncated: true },
              description: item.tokenId ? `#${item.tokenId}` : '–',
              descriptionProps: { isTruncated: true },
            }}
          />
          <ListItem.Column
            text={{
              label: profitLab,
              labelProps: {
                textAlign: 'right',
                color: profit > 0 ? 'text-success' : 'text-critical',
              },
              description: formatDistanceStrict(
                exit.timestamp,
                entry.timestamp,
              ),
              descriptionProps: { isTruncated: true, textAlign: 'right' },
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
        renderItem={renderItem}
        keyExtractor={(item) => (item.contractAddress as string) + item.tokenId}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={() => {
          if (loading) {
            return <Footer />;
          }
          return null;
        }}
        {...props}
        p={4}
      />
    </Box>
  );
};

export default Mobile;

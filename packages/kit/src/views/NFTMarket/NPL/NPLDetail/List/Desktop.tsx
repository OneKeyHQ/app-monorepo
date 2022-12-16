import React, { FC, useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Badge,
  CustomSkeleton,
  HStack,
  Hidden,
  Icon,
  List,
  ListItem,
  Skeleton,
  Text,
  Tooltip,
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
          w="200px"
          text={{
            label: <Skeleton shape="Body1" />,
            description: <Skeleton shape="Body2" />,
          }}
        />
        <ListItem.Column
          w="160px"
          text={{
            label: <Skeleton shape="Body1" />,
            description: <Skeleton shape="Body2" />,
          }}
        />
        <ListItem.Column
          w="140px"
          alignItems="flex-end"
          text={{
            label: <Skeleton shape="Body1" />,
          }}
        />
        <Hidden till="lg">
          <ListItem.Column
            w="140px"
            alignItems="flex-end"
            text={{
              label: <Skeleton shape="Body1" />,
            }}
          />
        </Hidden>
      </ListItem>
    ))}
  </>
);

const Desktop: FC<ListProps> = ({ network, loading, ...props }) => {
  const { formatDistanceStrict } = useFormatDate();
  const intl = useIntl();
  const renderItem: ListRenderItem<NFTNPL> = useCallback(
    ({ item }) => {
      const { asset, entry, exit, profit } = item;

      let entryBadge;
      if (entry.eventType === 'Mint') {
        entryBadge = intl.formatMessage({ id: 'content__mint' });
      } else if (entry.eventType === 'Transfer') {
        entryBadge = intl.formatMessage({ id: 'action__receive' });
      }

      const tradeValueEntry = new BigNumber(entry.tradePrice ?? 0)
        .decimalPlaces(3)
        .toString();
      const tradeValueExit = new BigNumber(
        exit.internalTxValue ?? exit.tokenTxValue ?? exit.tradePrice ?? 0,
      )
        .decimalPlaces(3)
        .toString();
      return (
        <ListItem>
          <ListItem.Column>
            {item.asset && (
              <NFTListImage
                asset={asset as NFTAsset}
                borderRadius="12px"
                size={40}
              />
            )}
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
          <Hidden till="md">
            <Tooltip label={entry.timestamp.toString()} placement="top left">
              <ListItem.Column
                w="200px"
                text={{
                  label: (
                    <HStack space={1} alignItems="center">
                      <Text typography="Body1Strong" numberOfLines={1}>
                        {PriceString({
                          price: tradeValueEntry,
                          symbol: entry.tradeSymbol,
                        })}
                      </Text>
                      {entryBadge && (
                        <Badge type="default" size="sm" title={entryBadge} />
                      )}
                    </HStack>
                  ),
                  description: (
                    <HStack space={1} alignItems="center">
                      <Icon name="GasIllus" size={16} color="icon-subdued" />
                      <Text
                        typography="Body2"
                        numberOfLines={1}
                        color="text-subdued"
                      >
                        {PriceString({
                          price: new BigNumber(entry.gasFee ?? 0)
                            .decimalPlaces(3)
                            .toString(),
                          networkId: network.id,
                        })}
                      </Text>
                    </HStack>
                  ),
                }}
              />
            </Tooltip>
          </Hidden>
          <Hidden till="md">
            <Tooltip label={exit.timestamp.toString()} placement="top left">
              <ListItem.Column
                w="160px"
                text={{
                  label: PriceString({
                    price: tradeValueExit,
                    symbol: exit.tradeSymbol,
                  }),
                  description: (
                    <HStack space={1} alignItems="center">
                      <Icon name="GasIllus" size={16} color="icon-subdued" />
                      <Text
                        typography="Body2"
                        numberOfLines={1}
                        color="text-subdued"
                      >
                        {PriceString({
                          price: new BigNumber(exit.gasFee ?? 0)
                            .decimalPlaces(3)
                            .toString(),
                          networkId: network.id,
                        })}
                      </Text>
                    </HStack>
                  ),
                }}
              />
            </Tooltip>
          </Hidden>
          <ListItem.Column
            w="140px"
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
              description: formatDistanceStrict(
                exit.timestamp,
                entry.timestamp,
              ),
              descriptionProps: { display: { lg: 'none' }, textAlign: 'right' },
            }}
          />
          <Hidden till="lg">
            <ListItem.Column
              w="140px"
              text={{
                label: formatDistanceStrict(exit.timestamp, entry.timestamp),
                labelProps: {
                  typography: 'Body1Strong',
                  textAlign: 'right',
                },
              }}
            />
          </Hidden>
        </ListItem>
      );
    },
    [formatDistanceStrict, intl, network.id],
  );

  return (
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
      contentContainerStyle={{
        width: '100%',
        maxWidth: 992 + 16 + 64, // 16 is padding of the content
        alignSelf: 'center',
        padding: 32,
      }}
      {...props}
    />
  );
};

export default Desktop;

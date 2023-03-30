import type { FC } from 'react';
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  CustomSkeleton,
  HStack,
  Hidden,
  Icon,
  List,
  ListItem,
  Pressable,
  Skeleton,
  Text,
  Tooltip,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { NFTAsset, NFTPNL } from '@onekeyhq/engine/src/types/nft';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import useFormatDate from '../../../../../hooks/useFormatDate';
import { CollectiblesModalRoutes } from '../../../../../routes/routesEnum';
import NFTListImage from '../../../../Wallet/NFT/NFTList/NFTListImage';
import { PriceString } from '../../../PriceText';

import type { ListRenderItem } from 'react-native';

type ListProps = {
  data: NFTPNL[];
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
  const { formatDistanceStrict, format } = useFormatDate();
  const intl = useIntl();
  const navigation = useNavigation();

  const handleSelectAsset = useCallback(
    (asset: NFTAsset) => {
      if (!network) return;
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.NFTDetailModal,
          params: {
            asset,
            network,
            isOwner: false,
          },
        },
      });
    },
    [navigation, network],
  );
  const renderItem: ListRenderItem<NFTPNL> = useCallback(
    ({ item }) => {
      const { asset, entry, exit, profit } = item;

      let profitLab = PriceString({
        price: new BigNumber(profit).decimalPlaces(3).toString(),
        symbol: item.exit.tradeSymbol,
      });
      profitLab = `${profit >= 0 ? '+' : ''}${profitLab}`;

      let entryBadge;
      if (entry.eventType === 'Mint') {
        entryBadge = intl.formatMessage({ id: 'content__mint' });
      } else if (entry.eventType === 'Transfer') {
        entryBadge = intl.formatMessage({ id: 'action__receive' });
      }
      // ${format(new Date(startTime), 'yyyy/MM/dd')}
      const tradeValueEntry = new BigNumber(entry.tradePrice ?? 0)
        .decimalPlaces(3)
        .toString();
      const tradeValueExit = new BigNumber(
        exit.internalTxValue ?? exit.tokenTxValue ?? exit.tradePrice ?? 0,
      )
        .decimalPlaces(3)
        .toString();

      let description = item.tokenId ? `#${item.tokenId}` : '–';
      if (
        item.contractAddress?.toLowerCase() ===
        '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85'
      ) {
        description = item.asset?.name as string;
      }
      return (
        <ListItem>
          <Pressable
            flex={1}
            flexDirection="row"
            alignItems="center"
            onPress={() => {
              if (asset) {
                handleSelectAsset(asset);
              }
            }}
          >
            {({ isHovered }) => (
              <>
                <ListItem.Column>
                  {item.asset && (
                    <NFTListImage
                      asset={asset as NFTAsset}
                      borderRadius="12px"
                      size={40}
                      opacity={isHovered ? 80 : undefined}
                    />
                  )}
                </ListItem.Column>
                <ListItem.Column
                  flex={1}
                  ml="12px"
                  text={{
                    label: item.contractName,
                    labelProps: {
                      typography: 'Body1Strong',
                      isTruncated: true,
                    },
                    description,
                    descriptionProps: { isTruncated: true },
                  }}
                />
              </>
            )}
          </Pressable>
          <Hidden till="md">
            <Tooltip
              label={format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm')}
              placement="top left"
            >
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
            <Tooltip
              label={format(new Date(exit.timestamp), 'yyyy-MM-dd HH:mm')}
              placement="top left"
            >
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
              label: profitLab,
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
    [format, formatDistanceStrict, handleSelectAsset, intl, network.id],
  );

  const ListFooterComponent = useCallback(() => {
    if (loading) {
      return <Footer />;
    }
    return null;
  }, [loading]);

  return (
    <List
      renderItem={renderItem}
      showDivider
      keyExtractor={(item) => (item.contractAddress as string) + item.tokenId}
      showsVerticalScrollIndicator={false}
      ListFooterComponent={ListFooterComponent}
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

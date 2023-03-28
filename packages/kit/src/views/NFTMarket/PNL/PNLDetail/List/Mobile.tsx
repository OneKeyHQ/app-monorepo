import type { FC } from 'react';
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import { BigNumber } from 'bignumber.js';

import {
  Box,
  CustomSkeleton,
  List,
  ListItem,
  Pressable,
  Skeleton,
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

  const { formatDistanceStrict } = useFormatDate();
  const renderItem: ListRenderItem<NFTPNL> = useCallback(
    ({ item }) => {
      const { asset, entry, exit, profit } = item;

      let profitLab = PriceString({
        price: new BigNumber(profit).decimalPlaces(3).toString(),
        symbol: item.exit.tradeSymbol,
      });
      profitLab = `${profit >= 0 ? '+' : ''}${profitLab}`;

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
            <ListItem.Column>
              <NFTListImage
                asset={asset as NFTAsset}
                borderRadius="12px"
                size={40}
              />
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
          </Pressable>
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
    [formatDistanceStrict, handleSelectAsset],
  );

  const ListFooterComponent = useCallback(() => {
    if (loading) {
      return <Footer />;
    }
    return <Box h="24px" />;
  }, [loading]);

  return (
    <Box flex={1}>
      <List
        renderItem={renderItem}
        keyExtractor={(item) =>
          `${item.contractAddress as string} ${item.tokenId}`
        }
        showsVerticalScrollIndicator={false}
        ListFooterComponent={ListFooterComponent}
        {...props}
        p={4}
      />
    </Box>
  );
};

export default Mobile;

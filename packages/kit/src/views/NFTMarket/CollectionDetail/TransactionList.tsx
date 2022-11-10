import React, { FC, useCallback, useEffect, useMemo, useRef } from 'react';

import { Row } from 'native-base';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Divider,
  Icon,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { Network } from '@onekeyhq/engine/src/types/network';
import { NFTTransaction } from '@onekeyhq/engine/src/types/nft';
import useOpenBlockBrowser from '@onekeyhq/kit/src/hooks/useOpenBlockBrowser';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useRuntime } from '../../../hooks/redux';
import useFormatDate from '../../../hooks/useFormatDate';
import { useIsMounted } from '../../../hooks/useIsMounted';
import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';
import StatsItemCell from '../Home/Stats/StatsItemCell';

import { useCollectionDetailContext } from './context';
import { ListProps } from './type';

// TODO:laoding view
const Footer: FC = () => <Box />;

export const ListHeader = () => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();
  if (isSmallScreen) {
    return <Box height="24px" />;
  }
  return (
    <Box
      width="full"
      flexDirection="column-reverse"
      height="64px"
      paddingBottom="16px"
    >
      <Row
        justifyContent="space-between"
        alignItems="center"
        space="12px"
        height="48px"
      >
        <Row flex={2.7} space="12px" alignItems="center">
          <Text color="text-subdued" typography="Subheading">
            {intl.formatMessage({
              id: 'title__nft',
            })}
          </Text>
        </Row>

        <Box flex={1} justifyContent="center">
          <Text
            textAlign="left"
            numberOfLines={1}
            typography="Subheading"
            color="text-subdued"
          >
            FROM
          </Text>
        </Box>
        <Box size="20px" />
        <Box flex={1} justifyContent="center">
          <Text
            textAlign="left"
            numberOfLines={1}
            typography="Subheading"
            color="text-subdued"
          >
            TO
          </Text>
        </Box>

        <Box flex={1} justifyContent="center">
          <Text
            textAlign="right"
            numberOfLines={1}
            typography="Subheading"
            color="text-subdued"
          >
            {intl.formatMessage({
              id: 'content__price',
            })}
          </Text>
        </Box>
      </Row>
    </Box>
  );
};

const MobileCell: FC<{ item: NFTTransaction }> = ({ item }) => {
  const { formatDistance } = useFormatDate();

  let name = `# ${item.asset?.tokenId ?? ''}`;
  if (item.asset?.name && item.asset?.name.length > 0) {
    name = item.asset?.name;
  }
  return (
    <StatsItemCell
      height="48px"
      title={name}
      subTitle={item.timestamp ? formatDistance(item.timestamp) : ''}
      logoComponent={
        item.asset && (
          <NFTListImage asset={item.asset} borderRadius="6px" size={40} />
        )
      }
      rightComponents={[
        <Box flexDirection="column" justifyContent="flex-start" height="100%">
          <Text
            textAlign="right"
            numberOfLines={1}
            typography="Body1Strong"
          >{`${item.tradePrice ?? 0} ${item.tradeSymbol ?? ''}`}</Text>
        </Box>,
      ]}
    />
  );
};

const DesktopCell: FC<{ network?: Network; item: NFTTransaction }> = ({
  network,
  item,
}) => {
  let name = `# ${item.asset?.tokenId ?? ''}`;
  if (item.asset?.name && item.asset?.name.length > 0) {
    name = item.asset?.name;
  }
  const { formatDistance } = useFormatDate();
  const { openAddressDetails } = useOpenBlockBrowser(network);
  return (
    <Row
      justifyContent="space-between"
      alignItems="center"
      space="12px"
      height="48px"
    >
      <Row flex={2.7} space="12px" alignItems="center">
        {item.asset && (
          <NFTListImage asset={item.asset} borderRadius="6px" size={40} />
        )}

        <Box flexDirection="column" flex={1}>
          <Text typography="Body1Strong" numberOfLines={1}>
            {name}
          </Text>
          <Text color="text-subdued" typography="Body2" numberOfLines={1}>
            {item.timestamp ? formatDistance(item.timestamp) : ''}
          </Text>
        </Box>
      </Row>

      <Pressable
        onPress={() => {
          openAddressDetails(item.send);
        }}
        flex={1}
        justifyContent="center"
      >
        <Text textAlign="right" numberOfLines={1} typography="Body1Underline">
          {item.send}
        </Text>
      </Pressable>

      <Icon name="ChevronDoubleRightSolid" size={20} />
      <Pressable
        onPress={() => {
          openAddressDetails(item.receive);
        }}
        flex={1}
        justifyContent="center"
      >
        <Text textAlign="right" numberOfLines={1} typography="Body1Underline">
          {item.receive}
        </Text>
      </Pressable>

      <Box flex={1} justifyContent="center">
        <Text textAlign="right" numberOfLines={1} typography="Body1Strong">
          {`${item.tradePrice ?? 0} ${item.tradeSymbol ?? ''}`}
        </Text>
      </Box>
    </Row>
  );
};

export const TransactionCell: FC<{
  network?: Network;
  item: NFTTransaction;
}> = ({ network, item }) => {
  const isSmallScreen = useIsVerticalLayout();
  if (isSmallScreen) {
    return <MobileCell item={item} />;
  }
  return <DesktopCell item={item} network={network} />;
};

const TransactionList: FC<ListProps> = ({
  contractAddress,
  networkId,
  ListHeaderComponent,
}) => {
  const isSmallScreen = useIsVerticalLayout();

  const context = useCollectionDetailContext()?.context;
  const setContext = useCollectionDetailContext()?.setContext;
  const cursor = useRef<string | undefined>();

  const { serviceNFT } = backgroundApiProxy;
  const isMounted = useIsMounted();

  const getData = useCallback(
    async (param: {
      chain: string;
      contractAddress: string;
      cursor?: string;
      eventTypes?: string;
      showAsset?: boolean;
    }) => {
      const data = await serviceNFT.getCollectionTransactions(param);
      if (data?.content) {
        cursor.current = data.next;
        if (setContext) {
          setContext((ctx) => {
            if (context?.refreshing) {
              return { ...ctx, txList: data.content };
            }
            return { ...ctx, txList: ctx.txList.concat(data?.content) };
          });
        }
      }
    },
    [context?.refreshing, serviceNFT, setContext],
  );
  useEffect(() => {
    (() => {
      if (context?.selectedIndex === 1 && isMounted) {
        if (context?.refreshing) {
          cursor.current = undefined;
        }
        if (cursor.current !== null) {
          getData({
            chain: networkId,
            contractAddress,
            cursor: cursor.current,
            eventTypes: 'sale',
            showAsset: true,
          }).then(() => {
            if (setContext) {
              setContext((ctx) => ({ ...ctx, refreshing: false }));
            }
          });
        }
      }
    })();
  }, [
    context?.refreshing,
    context?.selectedIndex,
    contractAddress,
    getData,
    isMounted,
    networkId,
    setContext,
  ]);

  const { networks } = useRuntime();
  const currentNetwork = useMemo(
    () => networks.find((n) => n.id === networkId),
    [networkId, networks],
  );

  const renderItem: ListRenderItem<NFTTransaction> = useCallback(
    ({ item }) => <TransactionCell item={item} network={currentNetwork} />,
    [currentNetwork],
  );
  const paddingX = isSmallScreen ? 16 : 51;

  return (
    <Tabs.FlatList<NFTTransaction>
      contentContainerStyle={{ paddingLeft: paddingX, paddingRight: paddingX }}
      ListHeaderComponent={ListHeaderComponent ?? ListHeader}
      ItemSeparatorComponent={() => (
        <Divider height="16px" bgColor="background-default" />
      )}
      data={context?.txList}
      renderItem={renderItem}
      ListFooterComponent={() => {
        if (cursor.current !== null) {
          return <Footer />;
        }
        return <Box />;
      }}
      onEndReached={() => {
        if (cursor.current !== null) {
          getData({
            chain: networkId,
            contractAddress,
            cursor: cursor.current,
            eventTypes: 'sale',
            showAsset: true,
          });
        }
      }}
    />
  );
};

export default TransactionList;

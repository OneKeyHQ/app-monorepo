import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  CustomSkeleton,
  FlatList,
  Icon,
  ListItem,
  Pressable,
  Skeleton,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { NFTTransaction } from '@onekeyhq/engine/src/types/nft';
import useOpenBlockBrowser from '@onekeyhq/kit/src/hooks/useOpenBlockBrowser';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNetworks } from '../../../hooks/redux';
import useFormatDate from '../../../hooks/useFormatDate';
import { useIsMounted } from '../../../hooks/useIsMounted';
import NFTListImage from '../../Wallet/NFT/NFTList/NFTListImage';

import { useCollectionDetailContext } from './context';

import type { ListProps } from './type';
import type { ListRenderItem } from 'react-native';

const Footer: FC = () => (
  <>
    {[1, 2, 3, 4, 5].map(() => (
      <ListItem px={0}>
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
          text={{
            label: <Skeleton shape="Body1" />,
          }}
        />
      </ListItem>
    ))}
  </>
);

export const ListHeader = () => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();
  if (isSmallScreen) {
    return null;
  }
  return (
    <ListItem width="full" px={0}>
      <ListItem.Column
        flex={2.7}
        text={{
          label: intl.formatMessage({
            id: 'title__nft',
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
          label: 'FROM',
          labelProps: {
            typography: 'Subheading',
            color: 'text-subdued',
            textAlign: 'left',
          },
        }}
      />
      <Box size="20px" />
      <ListItem.Column
        flex={1}
        text={{
          label: 'TO',
          labelProps: {
            typography: 'Subheading',
            color: 'text-subdued',
            textAlign: 'left',
          },
        }}
      />
      <ListItem.Column
        flex={1}
        text={{
          label: intl.formatMessage({
            id: 'content__price',
          }),
          labelProps: {
            typography: 'Subheading',
            color: 'text-subdued',
            textAlign: 'right',
          },
        }}
      />
    </ListItem>
  );
};

const MobileCell: FC<{ item: NFTTransaction }> = ({ item }) => {
  const { formatDistanceToNow } = useFormatDate();

  let name = `# ${item.asset?.tokenId ?? ''}`;
  if (item.asset?.name && item.asset?.name.length > 0) {
    name = item.asset?.name;
  }
  return (
    <ListItem width="full" px={0}>
      {item.asset && (
        <NFTListImage asset={item.asset} borderRadius="6px" size={40} />
      )}
      <ListItem.Column
        flex={1}
        text={{
          label: name,
          labelProps: { typography: 'Body1Strong', numberOfLines: 1 },
          description: item.timestamp
            ? formatDistanceToNow(item.timestamp)
            : '',
          descriptionProps: {
            numberOfLines: 1,
            typography: 'Body2',
            color: 'text-subdued',
          },
        }}
      />
      <ListItem.Column
        text={{
          label: `${item.tradePrice ?? 0} ${item.tradeSymbol ?? ''}`,
          labelProps: {
            typography: 'Body1Strong',
            textAlign: 'right',
            mb: '24px',
          },
        }}
      />
    </ListItem>
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
  const { formatDistanceToNow } = useFormatDate();
  const { openAddressDetails } = useOpenBlockBrowser(network);

  return (
    <ListItem width="full" px={0}>
      <Row flex={2.7} space="12px" alignItems="center">
        {item.asset && (
          <NFTListImage asset={item.asset} borderRadius="6px" size={40} />
        )}
        <ListItem.Column
          flex={1}
          text={{
            label: name,
            labelProps: { typography: 'Body1Strong', numberOfLines: 1 },
            description: item.timestamp
              ? formatDistanceToNow(item.timestamp)
              : '',
            descriptionProps: {
              numberOfLines: 1,
              typography: 'Body2',
              color: 'text-subdued',
            },
          }}
        />
      </Row>
      <ListItem.Column
        flex={1}
        text={{
          label: (
            <Pressable
              onPress={() => {
                openAddressDetails(item.send);
              }}
              flex={1}
              justifyContent="center"
            >
              <Text numberOfLines={1} typography="Body1Underline">
                {item.send}
              </Text>
            </Pressable>
          ),
        }}
      />
      <Icon name="ChevronDoubleRightMini" size={20} />
      <ListItem.Column
        flex={1}
        text={{
          label: (
            <Pressable
              onPress={() => {
                openAddressDetails(item.receive);
              }}
              flex={1}
              justifyContent="center"
            >
              <Text numberOfLines={1} typography="Body1Underline">
                {item.receive}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ListItem.Column
        flex={1}
        text={{
          label: `${item.tradePrice ?? 0} ${item.tradeSymbol ?? ''}`,
          labelProps: {
            typography: 'Body1Strong',
            textAlign: 'right',
          },
        }}
      />
    </ListItem>
  );
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

  const networks = useNetworks();
  const currentNetwork = useMemo(
    () => networks.find((n) => n.id === networkId),
    [networkId, networks],
  );

  const renderItem: ListRenderItem<NFTTransaction> = useCallback(
    ({ item }) => {
      if (isSmallScreen) {
        return <MobileCell item={item} />;
      }
      return <DesktopCell item={item} network={currentNetwork} />;
    },
    [currentNetwork, isSmallScreen],
  );

  const footer = useCallback(() => {
    if (cursor.current !== null) {
      return <Footer />;
    }
    return <Box />;
  }, []);
  return (
    <FlatList<NFTTransaction>
      ListHeaderComponent={ListHeaderComponent ?? ListHeader}
      data={context?.txList}
      renderItem={renderItem}
      ListFooterComponent={footer}
      style={{
        padding: isSmallScreen ? 16 : 32,
      }}
      contentContainerStyle={{
        width: '100%',
        maxWidth: 992,
        alignSelf: 'center',
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

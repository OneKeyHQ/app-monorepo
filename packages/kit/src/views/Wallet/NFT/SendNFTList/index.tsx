import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  FlatList,
  Text,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { FlatListProps } from '@onekeyhq/components/src/FlatList';
import { Collection } from '@onekeyhq/engine/src/types/nft';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useIsMounted } from '../../../../hooks/useIsMounted';
import { SendRoutes, SendRoutesParams } from '../../../../routes';

import SelectNFTCard from './SelectNFTCard';
import {
  SelectAsset,
  SendNFTContentProvider,
  useSendNFTContent,
} from './SendNFTContent';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.PreSendToken
>;

function useGridListLayout({
  maxCardWidth,
  pageWidth,
  numColumns,
  margin,
}: {
  maxCardWidth: number;
  pageWidth: number;
  numColumns: number;
  margin: number;
}) {
  const isSmallScreen = useIsVerticalLayout();

  return useMemo(() => {
    let cardWidth;
    let col;
    if (pageWidth === 0) {
      return { cardWidth: maxCardWidth, numColumns };
    }
    if (isSmallScreen) {
      col = numColumns;
      cardWidth = Math.floor(
        (pageWidth - margin * (numColumns - 1)) / numColumns,
      );
    } else {
      col = Math.floor((pageWidth + margin) / (maxCardWidth + margin));
      cardWidth = Math.floor((pageWidth - margin * (col - 1)) / col);
    }
    return { cardWidth, numColumns: col };
  }, [isSmallScreen, margin, maxCardWidth, numColumns, pageWidth]);
}

function List() {
  const { bottom } = useSafeAreaInsets();
  const isSmallScreen = useIsVerticalLayout();

  const content = useSendNFTContent();
  const { listData } = content?.context ?? { listData: [] };
  const [pageWidth, setPageWidth] = useState<number>(0);
  const { cardWidth, numColumns } = useGridListLayout({
    maxCardWidth: 112,
    numColumns: 3,
    margin: 8,
    pageWidth,
  });

  const renderItem = React.useCallback<
    NonNullable<FlatListProps<SelectAsset>['renderItem']>
  >(
    ({ item }) => (
      <SelectNFTCard
        cardWidth={cardWidth}
        key={item.tokenId ?? item.tokenAddress}
        marginRight="8px"
        asset={item}
      />
    ),
    [cardWidth],
  );

  return (
    <FlatList
      onLayout={(e) => {
        if (pageWidth !== e.nativeEvent.layout.width) {
          setPageWidth(e.nativeEvent.layout.width);
        }
      }}
      key={numColumns}
      numColumns={numColumns}
      data={listData}
      renderItem={renderItem}
      ListHeaderComponent={<Box h="24px" />}
      ListFooterComponent={
        <Box h={`${50 + bottom + (isSmallScreen ? 0 : 24)}px`} />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

function SendButton() {
  const isSmallScreen = useIsVerticalLayout();

  const content = useSendNFTContent();
  const { bottom } = useSafeAreaInsets();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const listData = content?.context.listData ?? [];
  const multiSelect = content?.context.multiSelect;
  if (listData.length === 0) {
    return null;
  }

  const selectNFTs = listData.filter((item) => item.selected === true);
  const isDisabled = selectNFTs.length === 0;
  const sendAction = () => {
    if (multiSelect === false) {
      const asset = listData.find((item) => item.selected === true);
      if (asset) {
        navigation.navigate(SendRoutes.PreSendAddress, {
          isNFT: true,
          from: '',
          to: '',
          amount: asset.amount ?? '1',
          token: asset.contractAddress ?? asset.tokenAddress,
          tokenId: asset.tokenId ?? asset.tokenAddress,
          type: asset.ercType,
        });
      }
    }
  };

  return (
    <Box
      position="absolute"
      width="100%"
      bottom={`${bottom + (isSmallScreen ? 0 : 24)}px`}
    >
      <Button
        isDisabled={isDisabled}
        width="full"
        height="50px"
        size="xl"
        type="primary"
        onPress={sendAction}
      >
        {multiSelect && selectNFTs.length > 0
          ? intl.formatMessage(
              {
                id: 'action__send_count_nfts',
              },
              { count: selectNFTs.length },
            )
          : intl.formatMessage({
              id: 'action__send',
            })}
      </Button>
    </Box>
  );
}

function SendNFTList() {
  const { account, networkId } = useActiveWalletAccount();
  const [collectibles, updateListData] = useState<Collection[]>([]);

  const allAssets = useMemo(
    () =>
      collectibles
        .map((collection) => collection.assets)
        .flat()
        .map((item) => ({ ...item, selected: false })),
    [collectibles],
  );
  const { serviceNFT } = backgroundApiProxy;
  const isMountedRef = useIsMounted();
  const fetchData = useCallback(async () => {
    if (account && networkId) {
      const result = await serviceNFT.fetchNFT({
        accountId: account.address,
        networkId,
      });
      return result;
    }
    return [];
  }, [account, networkId, serviceNFT]);

  useEffect(() => {
    (async () => {
      if (account && networkId) {
        const localData = await serviceNFT.getLocalNFTs({
          networkId,
          accountId: account.address,
        });
        if (isMountedRef.current) {
          updateListData(localData);
        }
        const requestData = await fetchData();
        if (isMountedRef.current) {
          updateListData(requestData);
        }
      }
    })();
  }, [account, fetchData, isMountedRef, networkId, serviceNFT]);

  return allAssets.length > 0 ? (
    <SendNFTContentProvider listData={allAssets} multiSelect={false}>
      <List />
      <SendButton />
    </SendNFTContentProvider>
  ) : (
    <Box flex={1} justifyContent="center" alignItems="center">
      <Text typography="Display2XLarge" fontSize={48} lineHeight={60}>
        🖼️
      </Text>
      <Text typography="DisplayMedium" mt="12px">
        No NFTs
      </Text>
    </Box>
  );
}

export default SendNFTList;

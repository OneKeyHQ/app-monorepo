import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  FlatList,
  Icon,
  Text,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { FlatListProps } from '@onekeyhq/components/src/FlatList';
import { IMPL_SOL } from '@onekeyhq/engine/src/constants';
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import { Collection } from '@onekeyhq/engine/src/types/nft';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount, useNetwork } from '../../../../hooks';
import { useIsMounted } from '../../../../hooks/useIsMounted';
import { SendRoutes } from '../../../../routes/routesEnum';
import { PreSendParams } from '../../../Send/types';

import SelectNFTCard from './SelectNFTCard';
import {
  SelectAsset,
  SendNFTContentProvider,
  useSendNFTContent,
} from './SendNFTContent';

import type { SendRoutesParams } from '../../../../routes';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.PreSendToken
>;

export function useGridListLayout({
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

function List({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { bottom } = useSafeAreaInsets();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isSmallScreen = useIsVerticalLayout();

  const { network } = useNetwork({ networkId });

  const intl = useIntl();
  const content = useSendNFTContent();
  const { listData } = content?.context ?? { listData: [] };
  const multiSelect = content?.context.multiSelect;
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
        accountId={accountId}
        networkId={networkId}
        cardWidth={cardWidth}
        key={item.tokenId ?? item.tokenAddress}
        marginRight="8px"
        asset={item}
      />
    ),
    [accountId, cardWidth, networkId],
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
      showsVerticalScrollIndicator={false}
      py="24px"
      ListHeaderComponent={
        multiSelect ? (
          <Box
            mb="16px"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
            }}
          >
            <Icon size={12} name="DocumentDuplicateSolid" />
            <Text
              typography="CaptionStrong"
              textAlign="center"
              position="relative"
              color="text-subdued"
              ml="10px"
            >
              {intl.formatMessage(
                {
                  id: 'form__supports_multi_send_nfts_on_network_name',
                },
                { network_name: network?.name },
              )}
            </Text>
          </Box>
        ) : null
      }
    />
  );
}

function SendButton({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const isVerticalLayout = useIsVerticalLayout();

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

  const transferInfos = selectNFTs.map((item) => ({
    from: '',
    to: '',
    isNFT: true,
    amount: item.amount ?? '1',
    token: item.contractAddress ?? item.tokenAddress,
    tokenId: item.tokenId ?? item.tokenAddress,
    type: item.ercType,
  }));
  const sendAction = () => {
    const params: PreSendParams = {
      ...transferInfos[0],
      accountId,
      networkId,
      transferInfos,
    };
    navigation.navigate(SendRoutes.PreSendAddress, params);
  };

  return (
    <Box pt="16px" pb={{ base: `${16 + bottom}px`, md: '24px' }}>
      <Button
        isDisabled={isDisabled}
        size={isVerticalLayout ? 'xl' : 'lg'}
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
              id: 'action__send_nft',
            })}
      </Button>
    </Box>
  );
}

function SendNFTList({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const [collectibles, updateListData] = useState<Collection[]>([]);
  const intl = useIntl();
  const { account } = useActiveSideAccount({ accountId, networkId });
  const { network } = useNetwork({ networkId });
  const { devMode } = useSettings();
  const enableMultiSelect = devMode?.enable;
  const multiSelect = Boolean(
    enableMultiSelect &&
      network &&
      (batchTransferContractAddress[network.id] || network.impl === IMPL_SOL),
  );

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
    <SendNFTContentProvider listData={allAssets} multiSelect={multiSelect}>
      <List accountId={accountId} networkId={networkId} />
      <SendButton accountId={accountId} networkId={networkId} />
    </SendNFTContentProvider>
  ) : (
    <Box flex={1} justifyContent="center" alignItems="center">
      <Text typography="Display2XLarge" fontSize={48} lineHeight={60}>
        🖼️
      </Text>
      <Text typography="DisplayMedium" mt="12px">
        {intl.formatMessage({ id: 'empty__no_nfts' })}
      </Text>
    </Box>
  );
}

export default SendNFTList;

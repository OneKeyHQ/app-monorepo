import { useCallback, useEffect, useMemo, useState } from 'react';

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
import type { FlatListProps } from '@onekeyhq/components/src/FlatList';
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import type { Collection } from '@onekeyhq/engine/src/types/nft';
import { IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount, useNetwork } from '../../../../hooks';
import { useIsMounted } from '../../../../hooks/useIsMounted';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../../routes/routesEnum';

import SelectNFTCard from './SelectNFTCard';
import { SendNFTContentProvider, useSendNFTContent } from './SendNFTContent';

import type { SendRoutesParams } from '../../../../routes';
import type { ModalScreenProps } from '../../../../routes/types';
import type { PreSendParams } from '../../../Send/types';
import type { SelectAsset } from './SendNFTContent';

type NavigationProps = ModalScreenProps<SendRoutesParams>;

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
  const content = useSendNFTContent();
  const { listData } = content?.context ?? { listData: [] };
  const [pageWidth, setPageWidth] = useState<number>(0);
  const { cardWidth, numColumns } = useGridListLayout({
    maxCardWidth: 112,
    numColumns: 3,
    margin: 8,
    pageWidth,
  });

  const renderItem = useCallback<
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
  const content = useSendNFTContent();
  const { bottom } = useSafeAreaInsets();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

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
    amount: item.selectAmount ?? '1',
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
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendModalRoutes.PreSendAddress,
        params,
      },
    });
  };

  return (
    <Box pt="16px" pb={{ base: `${16 + bottom}px`, md: '24px' }}>
      <Button
        isDisabled={isDisabled}
        size={platformEnv.isNative ? 'xl' : 'lg'}
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
  const multiSelect = Boolean(
    network &&
      (batchTransferContractAddress[network.id] || network.impl === IMPL_SOL),
  );

  const allAssets = useMemo(
    () =>
      collectibles
        .map((collection) => collection.assets)
        .flat()
        .map((item) => ({ ...item, selected: false, selectAmount: '0' })),
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

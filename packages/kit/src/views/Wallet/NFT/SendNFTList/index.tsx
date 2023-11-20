import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  FlatList,
  HStack,
  IconButton,
  Spinner,
  Text,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { FlatListProps } from '@onekeyhq/components/src/FlatList';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/nft';
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import type { Collection, NFTAsset } from '@onekeyhq/engine/src/types/nft';
import { IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  useActiveSideAccount,
  useAppSelector,
  useNFTIsLoading,
} from '../../../../hooks';
import { useGridListLayout } from '../../../../hooks/useGridListLayout';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../../routes/routesEnum';

import SelectNFTCard, { getKeyExtrator } from './SelectNFTCard';
import {
  atomSelectedSendNFTList,
  atomSendNFTList,
  useAtomSendNFTList,
  withProviderSendNFTList,
} from './sendNFTListContext';

import type { SendRoutesParams } from '../../../../routes';
import type { ModalScreenProps } from '../../../../routes/types';
import type { PreSendParams } from '../../../Send/types';
import type { LayoutChangeEvent } from 'react-native';

type NavigationProps = ModalScreenProps<SendRoutesParams>;

const pageSize = 20;

function SendButton({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const { bottom } = useSafeAreaInsets();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const [listData] = useAtomSendNFTList(atomSelectedSendNFTList);
  const [{ multi: multiSelect }] = useAtomSendNFTList(atomSendNFTList);

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
    nftTokenId: item.tokenId ?? item.tokenAddress,
    nftType: item.ercType,
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

const SendButtonMemo = memo(SendButton);

export type ISendNFTListData = {
  networkId: string;
  accountId: string;
};

export function HandleRebuildSendNFTListData(options: ISendNFTListData) {
  const { accountId, networkId } = options;
  const { network } = useActiveSideAccount({
    networkId,
    accountId,
  });
  const isNFTSupport = isCollectibleSupportedChainId(networkId);
  const refresherTs = useAppSelector((s) => s.refresher.refreshAccountNFTTs);
  const { activeNetworkId } = useAppSelector((s) => s.general);
  const { accountAddress } = useActiveSideAccount({
    networkId,
    accountId,
  });

  const fetchData = useCallback(async () => {
    if (
      accountId &&
      networkId &&
      isNFTSupport &&
      network?.settings.sendNFTEnable
    ) {
      await backgroundApiProxy.serviceNFT.fetchNFT({
        accountId,
        networkId,
      });
    }
  }, [accountId, isNFTSupport, networkId, network]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { result } = usePromiseResult(() => {
    if (refresherTs) {
      // pass
    }
    return backgroundApiProxy.serviceOverview.buildAccountNFTList({
      networkId,
      accountId,
    });
  }, [accountId, networkId, refresherTs]);
  const [, setNftList] = useAtomSendNFTList(atomSendNFTList);

  useEffect(() => {
    (() => {
      const data =
        result?.nfts
          ?.map((n) => n.data)
          .flat()
          ?.filter((t) => {
            if (isAllNetworks(activeNetworkId)) {
              return (
                t.networkId === networkId && t.accountAddress === accountAddress
              );
            }
            return true;
          })
          ?.map((c) => (c as Collection).assets)
          .flat() ?? [];

      setNftList({
        data,
        multi:
          !!batchTransferContractAddress[networkId] ||
          networkId.startsWith(IMPL_SOL),
      });
    })();
  }, [result, setNftList, networkId, accountAddress, activeNetworkId]);

  return null;
}

interface ISendNFTListProps {
  networkId: string;
  accountId: string;
}

const ListEmpty: FC<ISendNFTListProps> = ({ networkId, accountId }) => {
  const intl = useIntl();
  const nftIsLoading = useNFTIsLoading({
    networkId,
    accountId,
  });
  return (
    <Box flex={1} justifyContent="center" alignItems="center">
      {nftIsLoading ? (
        <Spinner size="lg" />
      ) : (
        <>
          <Text typography="Display2XLarge" fontSize={48} lineHeight={60}>
            🖼️
          </Text>
          <Text typography="DisplayMedium" mt="12px">
            {intl.formatMessage({ id: 'empty__no_nfts' })}
          </Text>
        </>
      )}
    </Box>
  );
};
const ListEmptyMemo = memo(ListEmpty);

function SendNFTList({ accountId, networkId }: ISendNFTListProps) {
  const intl = useIntl();
  const [page, setPage] = useState(1);
  const [{ data, multi }] = useAtomSendNFTList(atomSendNFTList);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const { cardWidth, numColumns } = useGridListLayout({
    maxCardWidth: 112,
    numColumns: 3,
    margin: 8,
    pageWidth,
  });

  const renderItem = useCallback<
    NonNullable<FlatListProps<NFTAsset>['renderItem']>
  >(
    ({ item }) => (
      <SelectNFTCard
        accountId={accountId}
        networkId={networkId}
        cardWidth={cardWidth}
        key={item.tokenId ?? item.tokenAddress}
        multiSelect={multi}
        asset={item}
      />
    ),
    [accountId, cardWidth, networkId, multi],
  );

  const pageData = useMemo(() => data.slice(0, page * pageSize), [data, page]);

  const handleLoadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (pageWidth !== e.nativeEvent.layout.width) {
        setPageWidth(e.nativeEvent.layout.width);
      }
    },
    [pageWidth],
  );

  const footer = useMemo(
    () =>
      page * pageSize < data.length ? (
        <HStack justifyContent="center" mb="8">
          <IconButton name="ChevronDownMini" onPress={handleLoadMore}>
            {intl.formatMessage({ id: 'action__load_more' })}
          </IconButton>
        </HStack>
      ) : null,
    [intl, page, data.length, handleLoadMore],
  );

  return (
    <Box onLayout={onLayout} flex="1">
      <HandleRebuildSendNFTListData
        networkId={networkId}
        accountId={accountId}
      />
      {pageWidth > 0 ? (
        <FlatList
          key={numColumns}
          numColumns={numColumns}
          data={pageData}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          py="24px"
          keyExtractor={getKeyExtrator}
          ListFooterComponent={footer}
          ListEmptyComponent={
            <ListEmptyMemo networkId={networkId} accountId={accountId} />
          }
        />
      ) : null}
      <SendButtonMemo accountId={accountId} networkId={networkId} />
    </Box>
  );
}
export default withProviderSendNFTList(SendNFTList);

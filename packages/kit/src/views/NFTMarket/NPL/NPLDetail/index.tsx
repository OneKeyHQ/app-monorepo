import React, {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { BigNumber } from 'bignumber.js';
import { Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  CustomSkeleton,
  Divider,
  Empty,
  Hidden,
  IconButton,
  ListItem,
  Searchbar,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import { NFTAsset, NFTNPL } from '@onekeyhq/engine/src/types/nft';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { HomeRoutes } from '../../../../routes/routesEnum';
import { HomeRoutesParams } from '../../../../routes/types';
import ChainSelector from '../../ChainSelector';
import { useDefaultNetWork } from '../../Home/hook';
import { PriceString } from '../../PriceText';
import { ShareNFTNPLRoutes, ShareNFTNPLRoutesParams } from '../Share/type';

import { useSearchAddress } from './hook';
import Desktop from './List/Desktop';
import Mobile from './List/Mobile';
import SearchAddress from './SearchAddress';

type NavigationProps = ModalScreenProps<ShareNFTNPLRoutesParams>;

type NPLData = {
  totalProfit?: BigNumber;
  win?: number;
  lose?: number;
  content: NFTNPL[];
};

function parseNPLData(items: NFTNPL[], network: Network): NPLData {
  let totalProfit: BigNumber = new BigNumber(0);
  let win = 0;
  let lose = 0;
  items.forEach((item) => {
    const { entry, exit } = item;
    const gasPriceNativeEntry = new BigNumber(entry.gasPrice ?? 0).shiftedBy(
      -network.decimals ?? 0,
    );
    const gasPriceNativeExit = new BigNumber(exit.gasPrice ?? 0).shiftedBy(
      -network.decimals ?? 0,
    );
    item.entry = {
      gasPriceNative: gasPriceNativeEntry.decimalPlaces(3).toString(),
      ...entry,
    };
    item.exit = {
      gasPriceNative: gasPriceNativeExit.decimalPlaces(3).toString(),
      ...exit,
    };
    const profit = new BigNumber(exit?.tradePrice ?? 0)
      .minus(entry?.tradePrice ?? 0)
      .minus(gasPriceNativeEntry)
      .minus(gasPriceNativeExit);
    if (profit.toNumber() > 0) {
      win += 1;
    } else if (profit.toNumber() < 0) {
      lose += 1;
    }
    item.profit = profit.toNumber();
    totalProfit = totalProfit.plus(profit);
  });
  return {
    totalProfit,
    win,
    lose,
    content: items,
  };
}

const ListTitle = () => (
  <ListItem mt="48px" px={0} py={0}>
    <ListItem.Column
      flex={304}
      text={{
        label: 'NFT',
        labelProps: {
          typography: 'Subheading',
          color: 'text-subdued',
        },
      }}
    />
    <ListItem.Column
      flex={180}
      text={{
        label: 'Entry Price',
        labelProps: {
          typography: 'Subheading',
          color: 'text-subdued',
        },
      }}
    />
    <ListItem.Column
      flex={180}
      text={{
        label: 'Exit value',
        labelProps: {
          typography: 'Subheading',
          color: 'text-subdued',
        },
      }}
    />
    <ListItem.Column
      flex={140}
      text={{
        label: 'profits',

        labelProps: {
          typography: 'Subheading',
          color: 'text-subdued',
          textAlign: 'right',
        },
      }}
    />
    <ListItem.Column
      flex={140}
      text={{
        label: 'hoDL duration',
        labelProps: {
          typography: 'Subheading',
          color: 'text-subdued',
          textAlign: 'right',
        },
      }}
    />
  </ListItem>
);

type HeaderProps = {
  loading?: boolean;
  network: Network;
  accountAddress: string;
  onAddressSearch: (address: string) => void;
} & NPLData;

const Header: FC<HeaderProps> = ({
  network,
  totalProfit,
  win,
  lose,
  accountAddress,
  onAddressSearch,
  content,
  loading,
}) => {
  let totalValue = '0';
  if (totalProfit) {
    totalValue = new BigNumber(totalProfit).decimalPlaces(3).toString();
    totalValue = `${totalProfit.toNumber() >= 0 ? '+' : '-'}${totalValue}`;
  }
  totalValue = PriceString({ price: totalValue, networkId: network.id });
  const [address, setAddress] = useState<string>(accountAddress ?? '');

  const [name, setName] = useState<string>('');

  useSearchAddress({
    keyword: address,
    network,
    onAddressSearch: ({ ens: ensName, address: vaildAddress }) => {
      if (ensName) {
        setName(ensName);
      }
      if (vaildAddress) {
        onAddressSearch(vaildAddress);
      }
    },
  });
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const shareAction = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ShareNFTNPL,
      params: {
        screen: ShareNFTNPLRoutes.ShareNFTNPLModal,
        params: {
          totalProfit,
          win,
          lose,
          assets: content,
          network,
          name,
          address,
          endTime: content[0].exit.timestamp,
          startTime: content[content.length - 1].exit.timestamp,
        },
      },
    });
  }, [address, content, lose, name, navigation, network, totalProfit, win]);

  return (
    <Box width="full" mb={isVerticalLayout ? '16px' : '8px'}>
      <Box width="full" flexDirection="row">
        <Searchbar
          flex={1}
          w="auto"
          maxW="400px"
          value={name || address}
          onChangeText={setAddress}
          onClear={() => {
            setAddress('');
            setName('');
          }}
          placeholder="Address, domain, or any DID"
        />
      </Box>
      <Box
        flexDirection={isVerticalLayout ? 'column' : 'row'}
        alignItems={isVerticalLayout ? 'flex-start' : 'center'}
        justifyContent="space-between"
      >
        <Box flexDirection="column" mt="24px">
          <Text typography="Body1" color="text-subdued">
            Profit
          </Text>
          {totalProfit ? (
            <Text
              typography="Display2XLarge"
              color={
                totalProfit.toNumber() > 0 ? 'text-success' : 'text-critical'
              }
            >
              {totalValue}
            </Text>
          ) : (
            <Box height="40px">
              <CustomSkeleton width="144px" height="20px" />
            </Box>
          )}

          <Box flexDirection="row" mt="8px">
            <Box flexDirection="row" mr="24px" alignItems="center">
              {win !== undefined ? (
                <Text mr="8px" typography="Body1Strong" color="text-success">
                  {win}
                </Text>
              ) : (
                <CustomSkeleton width="24px" height="12px" mr="6px" />
              )}

              <Text typography="Body1" color="text-subdued">
                Winning Flips
              </Text>
            </Box>

            <Box flexDirection="row" alignItems="center">
              {lose !== undefined ? (
                <Text mr="8px" typography="Body1Strong" color="text-critical">
                  {lose}
                </Text>
              ) : (
                <CustomSkeleton width="24px" height="12px" mr="6px" />
              )}

              <Text typography="Body1" color="text-subdued">
                Losing Flips
              </Text>
            </Box>
          </Box>
        </Box>
        <Row space="12px" height={isVerticalLayout ? '42px' : '38px'} mt="24px">
          {/* Buttons */}
          <Button
            isDisabled={loading}
            flex={1}
            type="primary"
            size="lg"
            leftIconName="ExternalLinkSolid"
            onPress={shareAction}
          >
            Share
          </Button>
        </Row>
      </Box>
      <Hidden from="base" till="sm">
        <ListTitle />
      </Hidden>
      <Divider mt={isVerticalLayout ? '24px' : '8px'} />
    </Box>
  );
};

const NPLDetail: FC<{ accountAddress: string; ens?: string }> = ({
  accountAddress,
}) => {
  const isVerticalLayout = useIsVerticalLayout();

  const navigation = useNavigation();
  const defaultNetwork = useDefaultNetWork();
  const [selectNetwork, setSelectNetwork] = useState<Network>(defaultNetwork);

  const { serviceNFT } = backgroundApiProxy;
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'NPL',
      headerRight: () => (
        <Row
          space={{ base: 2, md: 4 }}
          alignItems="center"
          mr={{ base: 4, md: 8 }}
        >
          <ChainSelector
            tiggerProps={{ display: 'none' }}
            triggerSize="lg"
            selectedNetwork={selectNetwork}
            onChange={setSelectNetwork}
          />
          <IconButton
            // isDisabled
            type="basic"
            size="sm"
            name="CalculatorSolid"
            circle
          />
        </Row>
      ),
    });
  }, [navigation, selectNetwork]);

  const [listData, updateListData] = useState<NFTNPL[]>([]);
  const allData = useRef<NPLData>({
    totalProfit: new BigNumber(0),
    lose: 0,
    win: 0,
    content: [],
  });
  const pageSize = 50;
  const currentPage = useRef<number>(0);
  const [totalNPLData, updateTotalNPLData] = useState<Omit<NPLData, 'content'>>(
    {},
  );
  const [address, setAddress] = useState<string>(accountAddress);
  const [loading, setLoading] = useState<boolean>(true);

  const getAssets = useCallback(
    async (page: number) => {
      const start = currentPage.current * pageSize;
      const pageDatas = allData.current?.content.slice(start, start + pageSize);
      const batchParams = pageDatas.map((item) => ({
        contract_address: item.contractAddress,
        token_id: item.tokenId,
      }));
      if (pageDatas.length === 0) {
        setLoading(false);
      }
      const data = await serviceNFT.batchAsset({
        chain: selectNetwork?.id,
        items: batchParams,
      });

      if (data) {
        const nftMap: Record<string, NFTAsset | undefined> = {};
        data.forEach((item) => {
          const key = `${item.contractAddress as string}-${
            item.tokenId as string
          }`;
          nftMap[key] = item;
        });
        pageDatas.forEach((item) => {
          const key = `${item.contractAddress as string}-${item.tokenId}`;
          const asset = nftMap[key];
          if (asset) {
            item.asset = asset;
          }
        });
        if (page === 0) {
          updateListData(pageDatas);
        } else {
          updateListData((prev) => prev.concat(pageDatas));
        }
      }
    },
    [selectNetwork?.id, serviceNFT],
  );

  const searchAction = useCallback(
    async (text: string, network: Network) => {
      const data = await serviceNFT.getNPLData({
        chain: network?.id,
        address: text,
      });

      const parseData = parseNPLData(data, network);
      allData.current = parseData;
      updateTotalNPLData({
        totalProfit: parseData.totalProfit,
        win: parseData.win,
        lose: parseData.lose,
      });
      if (data) {
        getAssets(0);
      }
    },
    [getAssets, serviceNFT],
  );

  useEffect(() => {
    setLoading(true);
    updateTotalNPLData({
      totalProfit: new BigNumber(0),
      win: 0,
      lose: 0,
    });
    currentPage.current = 0;
    updateListData([]);
    searchAction(address, selectNetwork);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, selectNetwork]);

  const listProps = useMemo(
    () => ({
      data: listData,
      ListHeaderComponent: () => (
        <Header
          accountAddress={accountAddress}
          network={selectNetwork}
          onAddressSearch={setAddress}
          content={allData.current.content}
          loading={listData.length === 0}
          {...totalNPLData}
        />
      ),
      ListEmptyComponent: () => {
        if (!loading) {
          return (
            <Empty
              emoji="💰"
              title="No Sales Record"
              subTitle="This address hasn’t sold any NFTs"
            />
          );
        }
        return null;
      },
      onEndReached: () => {
        currentPage.current += 1;
        getAssets(currentPage.current);
      },
    }),
    [accountAddress, getAssets, listData, loading, selectNetwork, totalNPLData],
  );

  return (
    <Box flex={1}>
      {isVerticalLayout ? (
        <Mobile {...listProps} loading={loading} network={selectNetwork} />
      ) : (
        <Desktop {...listProps} loading={loading} network={selectNetwork} />
      )}
    </Box>
  );
};

const NPLScreen = () => {
  const route =
    useRoute<RouteProp<HomeRoutesParams, HomeRoutes.NFTNPLScreen>>();
  const { accountAddress } = route.params;
  const [addressInfo, setAddressInfo] = useState<{
    address?: string;
    ens?: string;
  }>({ address: accountAddress });

  if (addressInfo.address) {
    return (
      <NPLDetail accountAddress={addressInfo.address} ens={addressInfo.ens} />
    );
  }
  return <SearchAddress onAddressSearch={setAddressInfo} />;
};

export default NPLScreen;

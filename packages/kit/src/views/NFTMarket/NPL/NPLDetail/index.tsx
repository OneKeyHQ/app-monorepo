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
  Center,
  CustomSkeleton,
  Divider,
  Empty,
  Hidden,
  IconButton,
  ListItem,
  Searchbar,
  Spinner,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { Network } from '@onekeyhq/engine/src/types/network';
import { NFTAsset, NFTNPL } from '@onekeyhq/engine/src/types/nft';
import {
  HomeRoutes,
  HomeRoutesParams,
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { AccountSelectorTrigger } from '../../../../components/NetworkAccountSelector/triggers/AccountSelectorTrigger';
import { useActiveWalletAccount } from '../../../../hooks';
import { useConnectAndCreateExternalAccount } from '../../../ExternalAccount/useConnectAndCreateExternalAccount';
// import ChainSelector from '../../ChainSelector';
import { useDefaultNetWork } from '../../Home/hook';
import { NFTMarketRoutes, NFTMarketRoutesParams } from '../../Modals/type';
import { PriceString } from '../../PriceText';

import { useSearchAddress } from './hook';
import Desktop from './List/Desktop';
import Mobile from './List/Mobile';
import SearchAddress from './SearchAddress';

type NavigationProps = ModalScreenProps<NFTMarketRoutesParams>;

type NPLData = {
  totalProfit?: BigNumber;
  win?: number;
  lose?: number;
  spend?: BigNumber;
  content: NFTNPL[];
};

function parseNPLData(items: NFTNPL[], network: Network): NPLData {
  let totalProfit: BigNumber = new BigNumber(0);
  let totalSpend: BigNumber = new BigNumber(0);
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

    const spend = new BigNumber(entry?.tradePrice ?? 0)
      .plus(gasPriceNativeEntry)
      .plus(gasPriceNativeExit);
    const profit = new BigNumber(exit?.tradePrice ?? 0).minus(spend);

    if (profit.toNumber() > 0) {
      win += 1;
    } else if (profit.toNumber() < 0) {
      lose += 1;
    }
    item.profit = profit.toNumber();
    totalProfit = totalProfit.plus(profit);
    totalSpend = totalSpend.plus(spend);
  });
  return {
    totalProfit,
    win,
    lose,
    spend: totalSpend,
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
  spend,
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
  const [nameOrAddress, setNameOrAddress] = useState<string>(
    accountAddress ?? '',
  );

  const name = useRef<string>();
  const { loading: inputLoading } = useSearchAddress({
    keyword: nameOrAddress,
    network,
    onAddressSearch: ({ ens: ensName, address: vaildAddress }) => {
      name.current = ensName;
      if (vaildAddress) {
        if (ensName) {
          setNameOrAddress(ensName);
        } else {
          setNameOrAddress(shortenAddress(vaildAddress));
        }
        onAddressSearch(vaildAddress);
      }
    },
  });
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const shareAction = useCallback(() => {
    let displayName = '';
    if (name.current && name.current?.length > 0) {
      displayName = name.current;
    } else {
      displayName = shortenAddress(nameOrAddress);
    }
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.NFTMarket,
      params: {
        screen: NFTMarketRoutes.ShareNFTNPLModal,
        params: {
          totalProfit,
          win,
          lose,
          assets: content,
          network,
          nameOrAddress: displayName,
          endTime: content[0].exit.timestamp,
          startTime: content[content.length - 1].exit.timestamp,
        },
      },
    });
  }, [content, lose, nameOrAddress, navigation, network, totalProfit, win]);

  const { account: activeAccount } = useActiveWalletAccount();

  useEffect(() => {
    if (activeAccount?.address) {
      setNameOrAddress(activeAccount?.address);
    }
  }, [activeAccount?.address]);

  const showClearBtn = useMemo(() => {
    if (nameOrAddress.length === 0) {
      return false;
    }
    if (inputLoading === true) {
      return false;
    }
    return true;
  }, [nameOrAddress, inputLoading]);

  return (
    <Box width="full" mb={isVerticalLayout ? '16px' : '8px'}>
      <Box width="full" flexDirection="row">
        <Searchbar
          flex={1}
          w="auto"
          maxW="400px"
          value={nameOrAddress}
          onChangeText={setNameOrAddress}
          rightIconName={showClearBtn ? 'XCircleMini' : undefined}
          rightElement={
            <Center height="full" right="8px">
              {inputLoading === true ? <Spinner size="sm" /> : null}
            </Center>
          }
          onClear={() => {
            setNameOrAddress('');
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

            <Box flexDirection="row" alignItems="center" mr="24px">
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

            <Hidden from="base" till="sm">
              <Box flexDirection="row" alignItems="center">
                {spend !== undefined ? (
                  <Text mr="8px" typography="Body1Strong">
                    {PriceString({
                      price: new BigNumber(spend).decimalPlaces(3).toString(),
                      networkId: network.id,
                    })}
                  </Text>
                ) : (
                  <CustomSkeleton width="24px" height="12px" mr="6px" />
                )}

                <Text typography="Body1" color="text-subdued">
                  Spend
                </Text>
              </Box>
            </Hidden>
          </Box>
        </Box>
        <Row space="12px" height={isVerticalLayout ? '42px' : '38px'} mt="24px">
          {/* Buttons */}
          <Button
            isDisabled={loading}
            flex={1}
            type="primary"
            size="lg"
            leftIconName="ArrowTopRightOnSquareSolid"
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
  const intl = useIntl();
  const { account: activeAccount } = useActiveWalletAccount();

  const navigation = useNavigation();
  const defaultNetwork = useDefaultNetWork();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectNetwork, setSelectNetwork] = useState<Network>(defaultNetwork);

  const { serviceNFT } = backgroundApiProxy;

  const { connectAndCreateExternalAccount } =
    useConnectAndCreateExternalAccount({
      networkId: selectNetwork?.id ?? '',
    });
  const calculatorAction = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.NFTMarket,
      params: {
        screen: NFTMarketRoutes.CalculatorModal,
        params: undefined,
      },
    });
  }, [navigation]);

  const connectAccountBtn = useMemo(() => {
    if (activeAccount?.id === undefined) {
      return (
        <Button onPress={connectAndCreateExternalAccount} mr={6}>
          {intl.formatMessage({ id: 'action__connect_wallet' })}
        </Button>
      );
    }
    return <AccountSelectorTrigger type="plain" />;
  }, [activeAccount?.id, connectAndCreateExternalAccount, intl]);
  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: () => (
        <Row
          space={{ base: 2, md: 4 }}
          alignItems="center"
          mr={{ base: 4, md: 8 }}
        >
          {/* <ChainSelector
            // tiggerProps={{ display: 'none' }}
            triggerSize="lg"
            selectedNetwork={selectNetwork}
            onChange={setSelectNetwork}
          /> */}
          {connectAccountBtn}
          <IconButton
            // isDisabled
            type="basic"
            size="sm"
            name="CalculatorSolid"
            circle
            onPress={calculatorAction}
          />
        </Row>
      ),
    });
  }, [calculatorAction, connectAccountBtn, navigation, selectNetwork]);

  const [listData, updateListData] = useState<NFTNPL[]>([]);
  const allData = useRef<NPLData>({
    totalProfit: new BigNumber(0),
    lose: 0,
    win: 0,
    spend: new BigNumber(0),
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
        return;
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
      serviceNFT.setNPLAddress(text);
      const parseData = parseNPLData(data, network);
      allData.current = parseData;
      updateTotalNPLData({
        totalProfit: parseData.totalProfit,
        win: parseData.win,
        lose: parseData.lose,
        spend: parseData.spend,
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
      spend: new BigNumber(0),
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
  const { address: lastAddress } = route.params;
  const { network, account } = useActiveWalletAccount();
  const isEvmAddress = network?.impl === IMPL_EVM;

  const [addressInfo, setAddressInfo] = useState<{
    address?: string;
    ens?: string;
  }>(() => {
    if (lastAddress && lastAddress.length > 0) {
      return { address: lastAddress };
    }
    return { address: isEvmAddress ? account?.address : undefined };
  });
  if (addressInfo?.address) {
    return (
      <NPLDetail accountAddress={addressInfo?.address} ens={addressInfo.ens} />
    );
  }
  return <SearchAddress onAddressSearch={setAddressInfo} />;
};

export default NPLScreen;

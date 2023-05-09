import type { FC } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
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
  HStack,
  Hidden,
  Icon,
  IconButton,
  ListItem,
  Searchbar,
  Skeleton,
  Spinner,
  Text,
  ToastManager,
  Tooltip,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { NFTAsset, NFTPNL } from '@onekeyhq/engine/src/types/nft';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { AccountSelectorTrigger } from '../../../../components/NetworkAccountSelector/triggers/AccountSelectorTrigger';
import { useActiveWalletAccount } from '../../../../hooks';
import { useConnectAndCreateExternalAccount } from '../../../ExternalAccount/useConnectAndCreateExternalAccount';
// import ChainSelector from '../../ChainSelector';
import { useDefaultNetWork } from '../../Home/hook';
import { NFTMarketRoutes } from '../../Modals/type';
import { PriceString } from '../../PriceText';

import { useSearchAddress } from './hook';
import Desktop from './List/Desktop';
import Mobile from './List/Mobile';
import SearchAddress from './SearchAddress';

import type { NFTMarketRoutesParams } from '../../Modals/type';

type NavigationProps = ModalScreenProps<NFTMarketRoutesParams>;

export type PNLData = {
  totalProfit?: BigNumber;
  totalWinProfit?: BigNumber;
  totalLoseProfit?: BigNumber;
  win?: number;
  lose?: number;
  spend?: BigNumber;
  content: NFTPNL[];
};

export function parsePNLData(items: NFTPNL[]): PNLData {
  let totalProfit: BigNumber = new BigNumber(0);
  let totalWinProfit: BigNumber = new BigNumber(0);
  let totalLoseProfit: BigNumber = new BigNumber(0);
  let totalSpend: BigNumber = new BigNumber(0);
  let win = 0;
  let lose = 0;
  items.forEach((item) => {
    const { entry, exit } = item;
    const gasEntry: BigNumber = new BigNumber(entry.gasFee ?? 0);
    const tradeValueEntry: BigNumber = new BigNumber(entry.tradePrice ?? 0);
    const gasExit: BigNumber = new BigNumber(exit.gasFee ?? 0);
    const tradeValueExit: BigNumber = new BigNumber(
      exit.internalTxValue ?? exit.tokenTxValue ?? exit.tradePrice ?? 0,
    );
    const spend = tradeValueEntry.plus(gasEntry).plus(gasExit);
    const profit = tradeValueExit.minus(spend);

    if (profit.toNumber() > 0) {
      win += 1;
      totalWinProfit = totalWinProfit.plus(profit);
    } else if (profit.toNumber() < 0) {
      lose += 1;
      totalLoseProfit = totalLoseProfit.plus(profit);
    }
    item.profit = profit.toNumber();
    item.spend = spend.toNumber();
    totalProfit = totalProfit.plus(profit);
    totalSpend = totalSpend.plus(spend);
  });
  return {
    totalProfit,
    totalWinProfit,
    totalLoseProfit,
    win,
    lose,
    spend: totalSpend,
    content: items,
  };
}

const ListTitle = () => {
  const intl = useIntl();

  return (
    <ListItem mt="48px" px={0} py={0}>
      <ListItem.Column
        flex={1}
        text={{
          label: 'NFT',
          labelProps: {
            typography: 'Subheading',
            color: 'text-subdued',
          },
        }}
      />
      <ListItem.Column
        w="200px"
        text={{
          label: intl.formatMessage({ id: 'content__entry_price' }),
          labelProps: {
            typography: 'Subheading',
            color: 'text-subdued',
          },
        }}
      />
      <ListItem.Column
        w="160px"
        text={{
          label: (
            <Tooltip
              label={intl.formatMessage({
                id: 'content__royalty_fees_are_excluded',
              })}
              placement="top left"
            >
              <HStack alignItems="center" space={1} alignSelf="flex-start">
                <Text typography="Subheading" color="text-subdued">
                  {intl.formatMessage({ id: 'content__exit_value' })}
                </Text>
                <Icon
                  name="QuestionMarkCircleMini"
                  size={16}
                  color="icon-subdued"
                />
              </HStack>
            </Tooltip>
          ),
          labelProps: {
            typography: 'Subheading',
            color: 'text-subdued',
          },
        }}
      />
      <ListItem.Column
        w="140px"
        text={{
          label: intl.formatMessage({ id: 'content__profit' }),

          labelProps: {
            typography: 'Subheading',
            color: 'text-subdued',
            textAlign: 'right',
          },
        }}
      />
      <Hidden till="lg">
        <ListItem.Column
          w="140px"
          text={{
            label: intl.formatMessage({ id: 'content__hodl_duration' }),
            labelProps: {
              typography: 'Subheading',
              color: 'text-subdued',
              textAlign: 'right',
            },
          }}
        />
      </Hidden>
    </ListItem>
  );
};

type HeaderProps = {
  loading?: boolean;
  network: Network;
  accountAddress: string;
  onAddressSearch: (address: string) => void;
} & PNLData;

const Header: FC<HeaderProps> = ({
  loading,
  network,
  accountAddress,
  onAddressSearch,
  ...pnlData
}) => {
  const { totalProfit, win, lose, spend } = pnlData;
  let totalValue = '0';
  if (totalProfit) {
    totalValue = new BigNumber(totalProfit).decimalPlaces(3).toString();
    totalValue = `${totalProfit.toNumber() >= 0 ? '+' : ''}${totalValue}`;
  }
  totalValue = PriceString({ price: totalValue, networkId: network.id });
  const [nameOrAddress, setNameOrAddress] = useState<string>(
    accountAddress ?? '',
  );
  const intl = useIntl();

  const name = useRef<string>();
  const { loading: inputLoading } = useSearchAddress({
    keyword: nameOrAddress,
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
    if (platformEnv.isNative) {
      let displayName = '';
      if (name.current && name.current?.length > 0) {
        displayName = name.current;
      } else {
        displayName = shortenAddress(nameOrAddress);
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.NFTMarket,
        params: {
          screen: NFTMarketRoutes.ShareNFTPNLModal,
          params: {
            network,
            nameOrAddress: displayName,
            data: pnlData,
          },
        },
      });
    } else {
      copyToClipboard('https://app.onekey.so/pnl');
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__link_copied' }),
      });
    }
  }, [intl, nameOrAddress, navigation, network, pnlData]);

  const { account: activeAccount } = useActiveWalletAccount();

  useEffect(() => {
    if (activeAccount?.address) {
      setNameOrAddress(activeAccount?.address);
    }
  }, [activeAccount?.address]);

  useEffect(() => {
    // Input on clear
    if (nameOrAddress.length === 0 && activeAccount?.address) {
      onAddressSearch(activeAccount?.address);
    }
  }, [activeAccount?.address, nameOrAddress, onAddressSearch]);

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
    <Box width="full" p={2} pb={{ base: 3, md: 0 }}>
      <Box width="full" flexDirection="row">
        <Searchbar
          w="full"
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
          placeholder={intl.formatMessage({
            id: 'form__enter_address_ens_name',
          })}
        />
      </Box>
      <Box
        flexDirection={{ sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        mt="24px"
      >
        <Box>
          <Text typography="Body1" color="text-subdued">
            {intl.formatMessage({ id: 'content__total_profits' })}
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
            <Skeleton shape="Display2XLarge" />
          )}

          <Box flexDirection="row" mt="8px">
            <Box flexDirection="row" mr="24px" alignItems="center">
              {win !== undefined ? (
                <Text mr="6px" typography="Body1Strong" color="text-success">
                  {win}
                </Text>
              ) : (
                <Skeleton shape="Body1" />
              )}

              <Text typography="Body1" color="text-subdued">
                {intl.formatMessage({ id: 'content__winning_flips' })}
              </Text>
            </Box>

            <Box flexDirection="row" alignItems="center" mr="24px">
              {lose !== undefined ? (
                <Text mr="6px" typography="Body1Strong" color="text-critical">
                  {lose}
                </Text>
              ) : (
                <Skeleton shape="Body1" />
              )}

              <Text typography="Body1" color="text-subdued">
                {intl.formatMessage({ id: 'content__losing_flips' })}
              </Text>
            </Box>

            <Hidden from="base" till="md">
              <Box flexDirection="row" alignItems="center">
                {spend !== undefined ? (
                  <Text mr="6px" typography="Body1Strong">
                    {PriceString({
                      price: new BigNumber(spend).decimalPlaces(3).toString(),
                      networkId: network.id,
                    })}
                  </Text>
                ) : (
                  <CustomSkeleton width="24px" height="12px" mr="6px" />
                )}

                <Text typography="Body1" color="text-subdued">
                  {intl.formatMessage({ id: 'content__spent' })}
                </Text>
              </Box>
            </Hidden>
          </Box>
        </Box>
        <Button
          isDisabled={loading}
          type="primary"
          size={isVerticalLayout ? 'lg' : 'base'}
          leftIconName="ArrowTopRightOnSquareSolid"
          onPress={shareAction}
          mt={{ base: 6, sm: 0 }}
        >
          {intl.formatMessage({ id: 'action__share' })}
        </Button>
      </Box>
      <Hidden from="base" till="md">
        <ListTitle />
      </Hidden>
      <Divider mt={{ base: '24px', md: '8px' }} />
    </Box>
  );
};
const pnlDataMap: Record<string, PNLData> = {};
const NPLDetail: FC<{ accountAddress: string; ens?: string }> = ({
  accountAddress,
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();
  const { account: activeAccount } = useActiveWalletAccount();

  const navigation = useNavigation();
  const selectNetwork = useDefaultNetWork();

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
        <Button onPress={connectAndCreateExternalAccount}>
          {intl.formatMessage({ id: 'action__connect_wallet' })}
        </Button>
      );
    }
    return (
      <AccountSelectorTrigger
        type={isVerticalLayout ? 'basic' : 'plain'}
        showAddress={!isVerticalLayout}
      />
    );
  }, [
    activeAccount?.id,
    connectAndCreateExternalAccount,
    intl,
    isVerticalLayout,
  ]);

  const headerRight = useCallback(
    () => (
      <Row
        space={2}
        alignItems="center"
        mr={{ base: 2.5, md: 8 }}
        justifyContent="flex-end"
      >
        {connectAccountBtn}
        <IconButton
          // isDisabled
          type="plain"
          size="lg"
          name="CalculatorOutline"
          circle
          onPress={calculatorAction}
        />
      </Row>
    ),
    [calculatorAction, connectAccountBtn],
  );
  useLayoutEffect(() => {
    navigation.setOptions({
      i18nTitle: isVerticalLayout
        ? ''
        : intl.formatMessage({ id: 'action__profit_and_loss' }),
      headerRight,
    });
  }, [headerRight, intl, isVerticalLayout, navigation]);

  const [listData, updateListData] = useState<NFTPNL[]>([]);
  const allData = useRef<PNLData>({
    totalProfit: new BigNumber(0),
    totalWinProfit: new BigNumber(0),
    totalLoseProfit: new BigNumber(0),
    lose: 0,
    win: 0,
    spend: new BigNumber(0),
    content: [],
  });
  const pageSize = 50;
  const currentPage = useRef<number>(0);
  const [totalPNLData, updateTotalPNLData] = useState<Omit<PNLData, 'content'>>(
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
        if (
          listData.length + pageDatas.length >=
          allData.current.content.length
        ) {
          setLoading(false);
        }
        if (page === 0) {
          updateListData(pageDatas);
        } else {
          updateListData((prev) => prev.concat(pageDatas));
        }
      }
    },
    [listData.length, selectNetwork?.id, serviceNFT],
  );

  const searchAction = useCallback(
    async (text: string) => {
      const cache = pnlDataMap[text];
      if (!cache) {
        const data = await serviceNFT.getPNLData({
          address: text,
        });
        const parseData = parsePNLData(data);
        allData.current = parseData;
        pnlDataMap[text] = parseData;
        updateTotalPNLData(parseData);

        if (data) {
          getAssets(0);
        }
      } else {
        allData.current = cache;
        updateTotalPNLData(cache);
        getAssets(0);
      }
    },
    [getAssets, serviceNFT],
  );

  useEffect(() => {
    setLoading(true);
    updateTotalPNLData({
      totalProfit: new BigNumber(0),
      spend: new BigNumber(0),
      win: 0,
      lose: 0,
    });
    currentPage.current = 0;
    updateListData([]);
    searchAction(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const ListHeaderComponent = useCallback(
    () => (
      <Header
        accountAddress={accountAddress}
        network={selectNetwork}
        onAddressSearch={setAddress}
        content={allData.current.content}
        loading={listData.length === 0}
        {...totalPNLData}
      />
    ),
    [accountAddress, listData.length, selectNetwork, totalPNLData],
  );

  const ListEmptyComponent = useCallback(() => {
    if (!loading) {
      return (
        <Empty
          emoji="💰"
          title={intl.formatMessage({ id: 'empty__no_sales_record' })}
          subTitle={intl.formatMessage({
            id: 'empty__no_sales_record_desc',
          })}
        />
      );
    }
    return null;
  }, [intl, loading]);

  const listProps = useMemo(
    () => ({
      data: listData,
      ListHeaderComponent,
      ListEmptyComponent,
      onEndReached: () => {
        currentPage.current += 1;
        getAssets(currentPage.current);
      },
    }),
    [ListEmptyComponent, ListHeaderComponent, getAssets, listData],
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
  const { network, account } = useActiveWalletAccount();
  const isEvmAddress = network?.impl === IMPL_EVM;

  const [addressInfo, setAddressInfo] = useState<{
    address?: string;
    ens?: string;
  }>(() => ({ address: isEvmAddress ? account?.address : undefined }));
  if (addressInfo?.address) {
    return (
      <NPLDetail accountAddress={addressInfo?.address} ens={addressInfo.ens} />
    );
  }
  return <SearchAddress onAddressSearch={setAddressInfo} />;
};

export default NPLScreen;

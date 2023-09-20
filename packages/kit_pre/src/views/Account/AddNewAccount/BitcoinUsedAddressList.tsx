import type { ComponentProps, Dispatch, FC, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  HStack,
  IconButton,
  List,
  ListItem,
  Spinner,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type {
  Account,
  BtcForkChainUsedAccount,
} from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { FormatBalance } from '../../../components/Format';
import { deviceUtils } from '../../../utils/hardware';

import BitcoinUsedAddressListItemMenu from './BitcoinUsedAddressListItemMenu';
import { showJumpPageDialog } from './JumpPage';

import type { ListRenderItemInfo } from 'react-native';

const USED_ADDRESS_PAGE_SIZE = 50;
const MANNUAL_ADDED_ADDRESS_PAGE_SIZE = 10;

export type ICopyAddress = ({
  address,
  path,
}: {
  address: string;
  path: string;
}) => void;

type ListTableHeaderProps = {
  valueLabel: string;
} & ComponentProps<typeof Box>;

const ListTableHeader: FC<ListTableHeaderProps> = ({ valueLabel }) => {
  const intl = useIntl();

  return (
    <ListItem p={0} mb="16px">
      <ListItem.Column
        text={{
          label: intl.formatMessage({ id: 'form__address' }),
          labelProps: { typography: 'Subheading', color: 'text-subdued' },
        }}
        flex={1}
      />
      <ListItem.Column
        alignItems="flex-end"
        text={{
          label: valueLabel,
          labelProps: {
            typography: 'Subheading',
            textAlign: 'right',
            color: 'text-subdued',
          },
        }}
        flex={1}
      />
      <ListItem.Column>
        <Box w="27px" />
      </ListItem.Column>
    </ListItem>
  );
};

type CellProps = {
  item: BtcForkChainUsedAccount;
  symbol: string | undefined;
  showPath: boolean;
  network: Network | undefined;
  showRemoveAddress?: boolean;
  onRemoveAddress?: (
    item: BtcForkChainUsedAccount & {
      suffixPath?: string;
    },
  ) => void;
  onCopyAddress: ICopyAddress;
} & ComponentProps<typeof Box>;

const AccountCell: FC<CellProps> = ({
  item,
  symbol,
  network,
  showPath,
  showRemoveAddress,
  onRemoveAddress,
  onCopyAddress,
}) => (
  <ListItem flex={1}>
    <ListItem.Column
      style={{
        // @ts-ignore
        userSelect: 'none',
      }}
      text={{
        label: shortenAddress(item.name),
        labelProps: { w: '120px' },
        description: showPath ? item.path : undefined,
        descriptionProps: { typography: 'Caption', w: '132px' },
        size: 'sm',
      }}
    />
    <ListItem.Column>
      <Box alignItems="flex-end" flex={1}>
        <FormatBalance
          balance={item.displayTotalReceived ?? item.balance}
          formatOptions={{
            fixed: item.decimals ?? network?.decimals,
          }}
          suffix={symbol}
          render={(ele) => (
            <Text
              typography={{ sm: 'Body2', md: 'Body2' }}
              style={{
                // @ts-ignore
                userSelect: 'none',
              }}
              wordBreak="break-all"
              textAlign="right"
            >
              {ele}
            </Text>
          )}
        />
      </Box>
    </ListItem.Column>
    <ListItem.Column>
      <BitcoinUsedAddressListItemMenu
        item={item}
        network={network ?? ({} as Network)}
        showRemoveOption={!!showRemoveAddress}
        onRemoveAddress={onRemoveAddress}
        onCopyAddress={onCopyAddress}
      >
        <IconButton
          alignItems="flex-end"
          type="plain"
          name="EllipsisVerticalMini"
          color="icon-subdued"
          size="xs"
          hitSlop={12}
          circle
        />
      </BitcoinUsedAddressListItemMenu>
    </ListItem.Column>
  </ListItem>
);

type ListTableFooterProps = {
  currentPage?: number;
  prevButtonDisabled?: boolean;
  nextButtonDisabled?: boolean;
  onPagePress: () => void;
  onNextPagePress: () => void;
  onPrevPagePress: () => void;
};

const ListTableFooter: FC<ListTableFooterProps> = ({
  currentPage,
  prevButtonDisabled,
  nextButtonDisabled,
  onPagePress,
  onNextPagePress,
  onPrevPagePress,
}) => (
  <Center pt={4}>
    <HStack space={0} alignItems="flex-end">
      <Button
        w="40px"
        type="basic"
        borderRightRadius={0}
        leftIconName="ChevronLeftMini"
        onPress={onPrevPagePress}
        isDisabled={prevButtonDisabled}
      />
      <Button
        w={platformEnv.isNative ? 'auto' : '39px'}
        h={platformEnv.isNative ? '37px' : '38px'}
        type="basic"
        onPress={onPagePress}
        isDisabled={false}
        borderLeftWidth={0}
        borderRightWidth={0}
        borderLeftRadius={0}
        borderRightRadius={0}
      >
        <Text maxW="30px" maxH="38px" isTruncated>
          {currentPage}
        </Text>
      </Button>
      <Button
        w="40px"
        type="basic"
        borderLeftRadius={0}
        leftIconName="ChevronRightMini"
        onPress={onNextPagePress}
        isDisabled={nextButtonDisabled}
      />
    </HStack>
  </Center>
);

type IListCommonProps = {
  network?: Network;
  config: {
    showPath: boolean;
    usedListCurrentPage: number;
    mannualListCurrentPage: number;
  };
  setConfig: Dispatch<
    SetStateAction<{
      showPath: boolean;
      usedListCurrentPage: number;
      mannualListCurrentPage: number;
    }>
  >;
  onCopyAddress: ICopyAddress;
};

type IUsedAddressListProps = IListCommonProps & {
  dataSource: BtcForkChainUsedAccount[];
};

const BitcoinUsedAddressList: FC<IUsedAddressListProps> = ({
  config,
  network,
  dataSource,
  setConfig,
  onCopyAddress,
}) => {
  const intl = useIntl();
  const maxPage = useMemo(
    () => Math.ceil(dataSource.length / USED_ADDRESS_PAGE_SIZE),
    [dataSource],
  );

  const isMaxPage = useMemo(
    () => config.usedListCurrentPage >= maxPage,
    [config.usedListCurrentPage, maxPage],
  );

  const currentPageData = useMemo(() => {
    const startIndex =
      (config.usedListCurrentPage - 1) * USED_ADDRESS_PAGE_SIZE;
    const res = dataSource.slice(
      startIndex,
      USED_ADDRESS_PAGE_SIZE + startIndex,
    );
    return res;
  }, [config.usedListCurrentPage, dataSource]);

  const itemSeparatorComponent = useCallback(
    () => (
      <>
        {!config.showPath && platformEnv.isNative ? <Box h="8px" /> : undefined}
      </>
    ),
    [config.showPath],
  );
  const rowRenderer = useCallback(
    ({ item }: ListRenderItemInfo<BtcForkChainUsedAccount>) => (
      <AccountCell
        network={network}
        symbol={network?.symbol}
        showPath={config.showPath}
        flex={1}
        item={item}
        onCopyAddress={onCopyAddress}
      />
    ),
    [network, config.showPath, onCopyAddress],
  );
  return (
    <>
      <ListTableHeader
        valueLabel={intl.formatMessage({ id: 'form__total_received' })}
      />
      <List
        data={currentPageData}
        renderItem={rowRenderer}
        keyExtractor={(item: BtcForkChainUsedAccount) => `${item.path}`}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={itemSeparatorComponent}
      />
      {maxPage > 1 && (
        <ListTableFooter
          currentPage={config.usedListCurrentPage}
          prevButtonDisabled={config.usedListCurrentPage === 1}
          nextButtonDisabled={isMaxPage}
          onPagePress={() => {
            showJumpPageDialog({
              currentPage: config.usedListCurrentPage - 1,
              maxPage,
              onConfirm: (page) => {
                setConfig((prev) => ({
                  ...prev,
                  usedListCurrentPage: page,
                }));
              },
            });
          }}
          onPrevPagePress={() => {
            setConfig((prev) => {
              if (prev.usedListCurrentPage === 0) return prev;
              return {
                ...prev,
                usedListCurrentPage: prev.usedListCurrentPage - 1,
              };
            });
          }}
          onNextPagePress={() => {
            setConfig((prev) => {
              if (isMaxPage) return prev;
              return {
                ...prev,
                usedListCurrentPage: prev.usedListCurrentPage + 1,
              };
            });
          }}
        />
      )}
    </>
  );
};

type IMannualAddedAddressListProps = IListCommonProps & {
  account: Account;
  dataSource: BtcForkChainUsedAccount[];
  onRequestBalances: (
    addresses: string[],
  ) => Promise<{ address: string; balance: string }[]>;
  onRefreshAccount: () => Promise<void>;
};

const BitcoinMannualAddedAddressList: FC<IMannualAddedAddressListProps> = ({
  config,
  network,
  setConfig,
  account,
  onRequestBalances,
  onRefreshAccount,
  onCopyAddress,
}) => {
  const intl = useIntl();

  const customAddresses = useMemo<Record<string, string>>(() => {
    try {
      if (typeof account.customAddresses === 'string') {
        return JSON.parse(account.customAddresses) as Record<string, string>;
      }
      if (typeof account.customAddresses === 'object') {
        return account.customAddresses;
      }
      return {};
    } catch {
      return {};
    }
  }, [account.customAddresses]);

  const dataSource = useMemo(
    () => Object.keys(customAddresses ?? {}),
    [customAddresses],
  );
  const maxPage = useMemo(
    () => Math.ceil(dataSource.length / MANNUAL_ADDED_ADDRESS_PAGE_SIZE),
    [dataSource],
  );

  const isMaxPage = useMemo(
    () => config.mannualListCurrentPage >= maxPage,
    [config.mannualListCurrentPage, maxPage],
  );

  useEffect(() => {
    const maxCurrentPage = Math.max(maxPage, 1);
    if (config.mannualListCurrentPage > maxCurrentPage) {
      setConfig((prev) => ({
        ...prev,
        mannualListCurrentPage: maxCurrentPage,
      }));
    }
  }, [maxPage, config.mannualListCurrentPage, setConfig]);

  const currentPageAddresses = useMemo(() => {
    const startIndex =
      (config.mannualListCurrentPage - 1) * MANNUAL_ADDED_ADDRESS_PAGE_SIZE;
    const suffixPaths = dataSource.slice(
      startIndex,
      MANNUAL_ADDED_ADDRESS_PAGE_SIZE + startIndex,
    );
    return suffixPaths.map((path) => customAddresses[path]).filter(Boolean);
  }, [config.mannualListCurrentPage, dataSource, customAddresses]);

  const [currentPageData, setCurrentPageData] = useState<
    { address: string; balance: string; path: string }[]
  >([]);

  const isFetchingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (isFetchingRef.current) return;
    if (!currentPageAddresses.length) {
      setCurrentPageData([]);
      return;
    }
    if (
      currentPageData.length === currentPageAddresses.length &&
      currentPageData.every((i) => currentPageAddresses.includes(i.address))
    ) {
      return;
    }
    isFetchingRef.current = true;
    setIsLoading(true);
    onRequestBalances(currentPageAddresses)
      .then((res) => {
        const data = res.map((item) => {
          const pathIndex = Object.values(customAddresses ?? {}).findIndex(
            (addr) => addr === item.address,
          );
          const suffixPath = Object.keys(customAddresses ?? {})[pathIndex];
          const path = `${account.path}/${suffixPath}`;
          return { ...item, name: item.address, path, suffixPath };
        });

        setCurrentPageData(data);
      })
      .finally(() => {
        isFetchingRef.current = false;
        setIsLoading(false);
      });
  }, [
    currentPageAddresses,
    customAddresses,
    account.path,
    currentPageData,
    onRequestBalances,
  ]);

  const itemSeparatorComponent = useCallback(
    () => (
      <>
        {!config.showPath && platformEnv.isNative ? <Box h="8px" /> : undefined}
      </>
    ),
    [config.showPath],
  );

  const removeAddress = useCallback(
    async (item: BtcForkChainUsedAccount & { suffixPath?: string }) => {
      try {
        if (!item.suffixPath && !item.name) return;
        await backgroundApiProxy.serviceDerivationPath.removeCustomAddress({
          accountId: account.id,
          addresses: { [item.suffixPath ?? '']: item.name },
        });
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__success' }),
        });
        setTimeout(() => {
          onRefreshAccount();
        }, 200);
      } catch (e) {
        deviceUtils.showErrorToast(e);
      }
    },
    [account.id, intl, onRefreshAccount],
  );

  const rowRenderer = useCallback(
    ({ item }: ListRenderItemInfo<BtcForkChainUsedAccount>) => (
      <AccountCell
        network={network}
        symbol={network?.symbol}
        showPath={config.showPath}
        flex={1}
        item={item}
        showRemoveAddress
        onRemoveAddress={removeAddress}
        onCopyAddress={onCopyAddress}
      />
    ),
    [network, config.showPath, removeAddress, onCopyAddress],
  );
  return (
    <>
      {isLoading ? (
        <Center flex={1}>
          <Spinner size="lg" />
        </Center>
      ) : (
        <>
          <ListTableHeader
            valueLabel={intl.formatMessage({ id: 'form__balance' })}
          />
          <List
            data={currentPageData as any}
            renderItem={rowRenderer}
            keyExtractor={(item: BtcForkChainUsedAccount) => `${item.path}`}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={itemSeparatorComponent}
          />
          {maxPage > 1 && (
            <ListTableFooter
              currentPage={config.mannualListCurrentPage}
              prevButtonDisabled={config.mannualListCurrentPage === 1}
              nextButtonDisabled={isMaxPage}
              onPagePress={() => {
                showJumpPageDialog({
                  currentPage: config.mannualListCurrentPage - 1,
                  maxPage,
                  onConfirm: (page) => {
                    setConfig((prev) => ({
                      ...prev,
                      mannualListCurrentPage: page,
                    }));
                  },
                });
              }}
              onPrevPagePress={() => {
                setConfig((prev) => {
                  if (prev.mannualListCurrentPage === 0) return prev;
                  return {
                    ...prev,
                    mannualListCurrentPage: prev.mannualListCurrentPage - 1,
                  };
                });
              }}
              onNextPagePress={() => {
                setConfig((prev) => {
                  if (isMaxPage) return prev;
                  return {
                    ...prev,
                    mannualListCurrentPage: prev.mannualListCurrentPage + 1,
                  };
                });
              }}
            />
          )}
        </>
      )}
    </>
  );
};

export { BitcoinUsedAddressList, BitcoinMannualAddedAddressList };

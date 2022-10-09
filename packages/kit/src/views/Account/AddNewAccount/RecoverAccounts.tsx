/* eslint-disable no-nested-ternary */
import React, {
  ComponentProps,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { ListRenderItemInfo } from 'react-native';

import {
  Box,
  Button,
  Center,
  CheckBox,
  Empty,
  HStack,
  Icon,
  Modal,
  Pressable,
  Spinner,
  Text,
  Typography,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type {
  Account,
  ImportableHDAccount,
} from '@onekeyhq/engine/src/types/account';
import IconAccount from '@onekeyhq/kit/assets/3d_account.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import useOpenBlockBrowser from '@onekeyhq/kit/src/hooks/useOpenBlockBrowser';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import { FormatBalance } from '../../../components/Format';
import { deviceUtils } from '../../../utils/hardware';
import { List, ListItem } from '../../Components/stories/List/ListView';

import { AdvancedValues, FROM_INDEX_MAX } from './RecoverAccountsAdvanced';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;

type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.RecoverAccountsList
>;

type FlatDataType = ImportableHDAccount & {
  selected: boolean;
  isDisabled: boolean;
};

type CellProps = {
  item: FlatDataType;
  decimal: number;
  showPathAndLink: boolean;
  onChange: (select: boolean) => void;
  openBlockExplorer: (address: string) => void;
} & ComponentProps<typeof Box>;

const AccountCell: FC<CellProps> = ({
  item,
  onChange,
  decimal,
  showPathAndLink,
  openBlockExplorer,
}) => {
  const [isChecked, setChecked] = useState(item.selected);

  useEffect(() => {
    setChecked(item.selected);
  }, [item.selected]);

  const onToggle = useCallback(() => {
    if (item.isDisabled) return;
    setChecked(!isChecked);
    onChange?.(!isChecked);
  }, [isChecked, item.isDisabled, onChange]);

  return (
    <ListItem onPress={onToggle} flex={1}>
      <ListItem.Column>
        <Box
          flexDirection="row"
          alignItems="flex-start"
          justifyContent="flex-start"
          w="55px"
        >
          <CheckBox
            w={6}
            isChecked={isChecked}
            isDisabled={item.isDisabled}
            onChange={onToggle}
          />
          <Text typography="Body2Strong" color="text-subdued">
            {item.index + 1}
          </Text>
        </Box>
      </ListItem.Column>
      <ListItem.Column
        text={{
          label: shortenAddress(item.displayAddress),
          description: showPathAndLink ? item.path : undefined,
        }}
        flex={1}
      />
      <ListItem.Column alignItems="flex-end">
        <FormatBalance
          balance={item.mainBalance}
          formatOptions={{
            fixed: decimal ?? 4,
          }}
          render={(ele) => <Typography.Body2>{ele}</Typography.Body2>}
        />
      </ListItem.Column>
      {showPathAndLink && (
        <ListItem.Column>
          <Pressable
            onPress={() => {
              openBlockExplorer(item.displayAddress);
            }}
          >
            <Icon name="ExternalLinkSolid" size={20} />
          </Pressable>
        </ListItem.Column>
      )}
    </ListItem>
  );
};

type ListTableHeaderProps = {
  symbol: string;
  isAllSelected: boolean;
  showPathAndLink: boolean;
  onChange: (v: boolean) => void;
} & ComponentProps<typeof Box>;

const ListTableHeader: FC<ListTableHeaderProps> = ({
  symbol,
  isAllSelected,
  showPathAndLink,
  onChange,
}) => {
  const intl = useIntl();

  return (
    <ListItem px={0} pt={0} pb={4}>
      <ListItem.Column>
        <Box
          flexDirection="row"
          alignItems="flex-start"
          justifyContent="flex-start"
          w="55px"
        >
          <CheckBox w={6} isChecked={isAllSelected} onChange={onChange} />
        </Box>
      </ListItem.Column>
      <ListItem.Column
        text={{
          label: intl.formatMessage({ id: 'form__address' }),
        }}
        flex={1}
      />
      <ListItem.Column
        alignItems="flex-end"
        text={{
          label: symbol,
        }}
      />
      {showPathAndLink && (
        <ListItem.Column
          icon={{
            name: 'ExternalLinkSolid',
            color: 'surface-subdued',
            size: 20,
          }}
        />
      )}
    </ListItem>
  );
};

type ListTableFooterProps = {
  minLimit?: number;
  count?: number;
  prevButtonDisabled?: boolean;
  nextButtonDisabled?: boolean;
  onAdvancedPress: () => void;
  onNextPagePress: () => void;
  onPrevPagePress: () => void;
};

const ListTableFooter: FC<ListTableFooterProps> = ({
  minLimit,
  count,
  prevButtonDisabled,
  nextButtonDisabled,
  onAdvancedPress,
  onNextPagePress,
  onPrevPagePress,
}) => {
  const intl = useIntl();
  const maxLimit = (minLimit ?? 0) + (count ?? 0) - 1;

  return (
    <HStack flexDirection="row" justifyContent="space-between" pt={4}>
      <Button
        type="basic"
        leftIconName="AdjustmentsSolid"
        alignItems="flex-start"
        onPress={onAdvancedPress}
      >
        {minLimit && count
          ? `${minLimit} - ${maxLimit}`
          : intl.formatMessage({ id: 'content__advanced' })}
      </Button>
      <HStack space={2} alignItems="flex-end">
        <Button
          type="basic"
          leftIconName="ChevronLeftSolid"
          onPress={onPrevPagePress}
          isDisabled={prevButtonDisabled}
        />
        <Button
          type="basic"
          leftIconName="ChevronRightSolid"
          onPress={onNextPagePress}
          isDisabled={nextButtonDisabled}
        />
      </HStack>
    </HStack>
  );
};

const PAGE_SIZE = 10;
const RecoverAccounts: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { password, walletId, network, purpose } = route.params;

  const navigation = useNavigation<NavigationProps['navigation']>();

  const [allCacheData, setAllCacheData] = useState<FlatDataType[]>([]);
  const [currentPageData, updateCurrentPageData] = useState<FlatDataType[]>([]);
  const { wallets, networks } = useRuntime();
  const [pageWidth, setPageWidth] = useState<number>(0);
  const selectedNetWork = networks.filter((n) => n.id === network)[0];
  const decimal = selectedNetWork?.nativeDisplayDecimals;
  const symbol = selectedNetWork?.symbol;
  const { openAddressDetails } = useOpenBlockBrowser(selectedNetWork);

  const [isAllSelected, setAllSelected] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [config, setConfig] = useState<AdvancedValues>({
    fromIndex: 1,
    generateCount: 0,
    showPathAndLink: false,
  });

  const wallet = wallets.find((w) => w.id === walletId) ?? null;

  const [isInitLoading, setInitLoading] = useState(true);
  const [isLoading, setLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const isFetchingData = useRef(false);
  const activeAccounts = useRef<Account[]>([]);
  const obj = useState(() => {
    let resolve: () => void = () => {};
    const p = new Promise<void>((fn) => (resolve = fn));
    return { p, resolve };
  })[0];

  useEffect(() => {
    async function refreshActiveAccounts() {
      if (wallet) {
        activeAccounts.current = await backgroundApiProxy.engine.getAccounts(
          wallet.accounts,
          network,
        );
        obj.resolve();
      }
      return activeAccounts;
    }
    refreshActiveAccounts();
  }, [network, wallet, obj]);

  const getData = useCallback(
    async (
      pageIndex: number,
      pageSize: number,
      pathFromIndex: number,
      generateCount: number,
      cacheData: FlatDataType[],
      selectAll = false,
    ) => {
      const lastPage = Math.ceil(generateCount / PAGE_SIZE) - 1;
      const isLastPage = generateCount !== 0 && pageIndex === lastPage;

      let page = 0;
      if (pageIndex < 0) {
        page = 0;
      } else if (generateCount && isLastPage) {
        page = lastPage;
      } else {
        page = pageIndex;
      }

      const start = page * pageSize + pathFromIndex - 1;
      let limit = pageSize;
      if (pageIndex === 0 && generateCount > 0 && generateCount < pageSize) {
        limit = generateCount;
      } else if (isLastPage) {
        limit = generateCount - page * pageSize;
      }
      if (start + limit > FROM_INDEX_MAX) {
        limit = FROM_INDEX_MAX - start;
      }

      const allCacheStart = page * pageSize;
      const targetNumber = page * pageSize + limit;

      if (cacheData.length >= targetNumber) {
        updateCurrentPageData(
          cacheData.slice(allCacheStart, allCacheStart + limit),
        );
        return;
      }

      isFetchingData.current = true;
      setLoading(true);
      try {
        await backgroundApiProxy.engine
          .searchHDAccounts(walletId, network, password, start, limit, purpose)
          .then((accounts) => {
            if (pageIndex === 0) {
              setInitLoading(false);
            }

            isFetchingData.current = false;
            setAllCacheData(() => {
              const data = cacheData.concat(
                accounts.map((item) => {
                  const isDisabled = activeAccounts.current.some(
                    (a) => a.path === item.path,
                  );
                  return {
                    ...item,
                    selected: isDisabled || selectAll,
                    isDisabled,
                  };
                }),
              );

              updateCurrentPageData(
                data.slice(allCacheStart, allCacheStart + limit),
              );
              setIsValid(data.some((i) => !i.isDisabled && i.selected));
              setLoading(false);
              return data;
            });
          });
      } catch (e) {
        isFetchingData.current = false;
        if (navigation.isFocused()) {
          setTimeout(() => {
            deviceUtils.showErrorToast(e, 'msg__engine__internal_error');
          }, 200);
        }

        navigation?.goBack?.();
        navigation?.goBack?.();
      }
    },
    [navigation, network, password, purpose, walletId],
  );

  const checkBoxOnChange = useCallback(
    (isSelected: boolean, item: FlatDataType, index: number): boolean => {
      setAllCacheData((prev) => {
        if (
          !prev[item.index]?.isDisabled &&
          prev[item.index]?.path === item.path
        ) {
          prev[item.index].selected = isSelected;
        }

        return prev;
      });
      updateCurrentPageData((prev) => {
        if (!prev[index]?.isDisabled && prev[index]?.path === item.path) {
          prev[index].selected = isSelected;
        }

        return prev;
      });

      setIsValid(allCacheData.some((i) => !i.isDisabled && i.selected));

      if (!isSelected) {
        setAllSelected(false);
      } else {
        const selectedAll = allCacheData.every((i) => i.selected);
        setAllSelected(selectedAll);
      }
      return true;
    },
    [allCacheData],
  );

  const onRefreshCheckBox = useCallback((selectedAll: boolean) => {
    setAllCacheData((prev) => {
      const cacheData = prev.map((item) => ({
        ...item,
        selected: item.isDisabled ? item.selected : selectedAll,
      }));

      setIsValid(cacheData.some((i) => !i.isDisabled && i.selected));
      return cacheData;
    });
    updateCurrentPageData((prev) =>
      prev.map((item) => ({
        ...item,
        selected: item.isDisabled ? item.selected : selectedAll,
      })),
    );
  }, []);

  const rowRenderer = useCallback(
    ({ item, index }: ListRenderItemInfo<FlatDataType>) => (
      <AccountCell
        decimal={decimal}
        showPathAndLink={config.showPathAndLink}
        flex={1}
        item={item}
        onChange={(selected) => {
          checkBoxOnChange(selected, item, index);
        }}
        openBlockExplorer={openAddressDetails}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkBoxOnChange, config.showPathAndLink],
  );

  useEffect(() => {
    getData(
      currentPage,
      PAGE_SIZE,
      config.fromIndex,
      config.generateCount ?? 0,
      allCacheData,
      isAllSelected,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  /**
   * if the hardware method is still being called when the page jumps,
   * the process is cancelled
   */
  function hardwareCancel() {
    if (isFetchingData.current) {
      backgroundApiProxy.engine
        .getHWDeviceByWalletId(walletId)
        .then((device) => {
          if (device) {
            backgroundApiProxy.serviceHardware.cancel(device.mac).then(() => {
              setTimeout(() => (isFetchingData.current = false), 500);
            });
          }
        });
    }
  }

  useEffect(
    () => () => hardwareCancel(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const isDisabled = useMemo(() => {
    if (isLoading) return true;
    return !isValid;
  }, [isValid, isLoading]);

  const isMaxPage = useMemo(() => {
    if (currentPageData.length < PAGE_SIZE) return true;
    if (config.fromIndex >= FROM_INDEX_MAX) return true;
    if (!config.generateCount) return false;

    return currentPage === Math.ceil(config.generateCount / PAGE_SIZE) - 1;
  }, [
    config.fromIndex,
    config.generateCount,
    currentPage,
    currentPageData.length,
  ]);

  return (
    <Modal
      height="640px"
      header={intl.formatMessage({ id: 'action__recover_accounts' })}
      headerDescription={`${selectedNetWork?.name}`}
      primaryActionTranslationId="action__recover"
      onPrimaryActionPress={() => {
        hardwareCancel();
        navigation.navigate(CreateAccountModalRoutes.RecoverAccountsConfirm, {
          accounts: allCacheData,
          walletId,
          network,
          purpose,
          existingAccounts: activeAccounts.current,
          config,
          selectedAll: isAllSelected,
        });
      }}
      primaryActionProps={{
        isDisabled,
      }}
      hideSecondaryAction
      staticChildrenProps={{
        flex: 1,
        padding: '16px',
        background: 'surface-subdued',
        onLayout: (e) => {
          if (pageWidth === 0) {
            setPageWidth(e.nativeEvent.layout.width);
          }
        },
      }}
    >
      {isInitLoading || isLoading ? (
        <Center flex={1}>
          <Spinner size="lg" />
        </Center>
      ) : (
        <Box flex={1}>
          <ListTableHeader
            symbol={symbol}
            isAllSelected={isAllSelected}
            showPathAndLink={config.showPathAndLink}
            onChange={(selectedAll) => {
              setAllSelected(selectedAll);
              onRefreshCheckBox(selectedAll);
            }}
          />
          {currentPageData.length === 0 ? (
            <Center flex={1}>
              <Empty
                imageUrl={IconAccount}
                title={intl.formatMessage({
                  id: 'empty__no_account_title',
                })}
                subTitle={intl.formatMessage({
                  id: 'empty__no_recoverable_account_desc',
                })}
                actionTitle={intl.formatMessage({
                  id: 'action__retry',
                })}
                handleAction={() => {
                  getData(
                    currentPage,
                    PAGE_SIZE,
                    config.fromIndex,
                    config.generateCount ?? 0,
                    allCacheData,
                    isAllSelected,
                  );
                }}
              />
            </Center>
          ) : (
            <List
              data={currentPageData}
              showDivider
              renderItem={rowRenderer}
              keyExtractor={(item: FlatDataType) => `${item.index}`}
              extraData={isAllSelected}
            />
          )}
          <ListTableFooter
            minLimit={config.fromIndex}
            count={config.generateCount}
            prevButtonDisabled={currentPage === 0}
            nextButtonDisabled={isMaxPage}
            onPrevPagePress={() => {
              setCurrentPage((prev) => {
                if (prev === 0) return prev;
                return prev - 1;
              });
            }}
            onNextPagePress={() => {
              setCurrentPage((prev) => {
                if (isMaxPage) return prev;
                return prev + 1;
              });
            }}
            onAdvancedPress={() => {
              navigation.navigate(
                CreateAccountModalRoutes.RecoverAccountsAdvanced,
                {
                  fromIndex: config.fromIndex,
                  generateCount: config.generateCount,
                  showPathAndLink: config.showPathAndLink,
                  onApply: ({
                    fromIndex,
                    generateCount: count,
                    showPathAndLink: showPath,
                  }) => {
                    setTimeout(() => {
                      const isForceRefresh =
                        config.fromIndex !== fromIndex ||
                        config.generateCount !== count;

                      const selectedAll = (count ?? 0) > 0;
                      const newConfig = {
                        currentPage: isForceRefresh ? 0 : currentPage,
                        fromIndex,
                        generateCount: count,
                        showPathAndLink: showPath,
                      };

                      setConfig(newConfig);
                      setCurrentPage(newConfig.currentPage);
                      if (selectedAll) setAllSelected(selectedAll);
                      getData(
                        newConfig.currentPage,
                        PAGE_SIZE,
                        newConfig.fromIndex,
                        newConfig.generateCount ?? 0,
                        isForceRefresh ? [] : allCacheData,
                        selectedAll ? true : isAllSelected,
                      );
                    });
                  },
                },
              );
            }}
          />
        </Box>
      )}
    </Modal>
  );
};

export default RecoverAccounts;

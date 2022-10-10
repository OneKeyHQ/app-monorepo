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
  List,
  ListItem,
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
import { getTimeStamp } from '@onekeyhq/kit/src/utils/helper';

import { FormatBalance } from '../../../components/Format';
import { deviceUtils } from '../../../utils/hardware';

import { FROM_INDEX_MAX } from './RecoverAccountsAdvanced';

import type {
  AdvancedValues,
  RecoverAccountType as RecoverAccountConfirmType,
} from './types';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;

type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.RecoverAccountsList
>;

type RecoverAccountType = ImportableHDAccount;
type SelectStateType = {
  selected: boolean;
  isDisabled: boolean;
};

type CellProps = {
  item: RecoverAccountType;
  state: SelectStateType | undefined;
  decimal: number;
  showPathAndLink: boolean;
  onChange: (select: boolean) => void;
  openBlockExplorer: (address: string) => void;
} & ComponentProps<typeof Box>;

const AccountCell: FC<CellProps> = ({
  item,
  state,
  onChange,
  decimal,
  showPathAndLink,
  openBlockExplorer,
}) => {
  const [isChecked, setChecked] = useState(state?.selected ?? false);

  useEffect(() => {
    setChecked(state?.selected ?? false);
  }, [state?.selected]);

  const onToggle = useCallback(() => {
    if (state?.isDisabled) return;
    setChecked(!isChecked);
    onChange?.(!isChecked);
  }, [isChecked, state?.isDisabled, onChange]);

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
            isDisabled={state?.isDisabled ?? false}
            onChange={onToggle}
            pointerEvents="box-only"
          />
          <Text
            style={{
              // @ts-ignore
              userSelect: 'none',
            }}
            typography="Body2Strong"
            color="text-subdued"
          >
            {item.index + 1}
          </Text>
        </Box>
      </ListItem.Column>
      <ListItem.Column
        style={{
          // @ts-ignore
          userSelect: 'none',
        }}
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
          render={(ele) => (
            <Typography.Body2
              style={{
                // @ts-ignore
                userSelect: 'none',
              }}
            >
              {ele}
            </Typography.Body2>
          )}
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
        <ListItem.Column>
          <Box w={5} />
        </ListItem.Column>
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

  const [loadedAccounts, setLoadedAccounts] = useState<
    Map<number, RecoverAccountType>
  >(new Map());
  const [selectState, setSelectState] = useState<Map<number, SelectStateType>>(
    new Map(),
  );

  const [currentPageData, updateCurrentPageData] = useState<
    RecoverAccountType[]
  >([]);

  const { wallets, networks } = useRuntime();
  const [pageWidth, setPageWidth] = useState<number>(0);
  const selectedNetWork = networks.filter((n) => n.id === network)[0];
  const decimal = selectedNetWork?.nativeDisplayDecimals;
  const symbol = selectedNetWork?.symbol;
  const { openAddressDetails } = useOpenBlockBrowser(selectedNetWork);

  const [isAllSelected, setAllSelected] = useState(false);
  const [config, setConfig] = useState<
    AdvancedValues & { currentPage: number }
  >({
    currentPage: 0,
    fromIndex: 1,
    generateCount: 0,
    showPathAndLink: false,
  });
  const [realGenerateCount, setRealGenerateCount] = useState(Number.MAX_VALUE);
  const [refreshTimestamp, setRefreshTimestamp] = useState(getTimeStamp());

  const isBatchMode = useMemo(
    () => config.generateCount && config.generateCount > 0,
    [config.generateCount],
  );

  const wallet = wallets.find((w) => w.id === walletId) ?? null;

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

  useEffect(() => {
    if (isLoading) return;
    isFetchingData.current = true;
    setLoading(true);

    const pageIndex = config.currentPage;
    const pageSize = PAGE_SIZE;
    const fromPathIndex = config.fromIndex;
    const generateCount = config.generateCount ?? 0;

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

    const start = page * pageSize + fromPathIndex - 1;
    let limit = pageSize;
    if (pageIndex === 0 && isBatchMode && generateCount < pageSize) {
      limit = generateCount;
    } else if (isLastPage) {
      limit = generateCount - page * pageSize;
    }
    if (start + limit > FROM_INDEX_MAX) {
      limit = FROM_INDEX_MAX - start;
    }

    const toAddAccountIndex = Array.from(Array(limit).keys()).map(
      (index) => start + index,
    );

    const currentPageArray: RecoverAccountType[] = [];
    if (
      toAddAccountIndex.every((i) => {
        const account = loadedAccounts.get(i);
        if (account) {
          currentPageArray.push(account);
          return true;
        }
        return false;
      })
    ) {
      updateCurrentPageData(currentPageArray);
      isFetchingData.current = false;
      setLoading(false);
      return;
    }

    backgroundApiProxy.engine
      .searchHDAccounts(walletId, network, password, start, limit, purpose)
      .then((accounts) => {
        if (accounts.length !== limit || accounts.length !== pageSize) {
          limit = accounts.length;
          setRealGenerateCount(start + accounts.length - fromPathIndex + 1);
        }

        const addedAccounts = new Map(loadedAccounts);
        const addedSelectState = new Map<number, SelectStateType>(selectState);
        accounts.forEach((i) => {
          const isDisabled = activeAccounts.current.some(
            (a) => a.path === i.path,
          );
          addedSelectState.set(i.index, {
            isDisabled,
            selected: isDisabled || !!isBatchMode,
          });
          addedAccounts.set(i.index, i);
        });

        isFetchingData.current = false;
        updateCurrentPageData(accounts);
        setLoadedAccounts(addedAccounts);
        setSelectState(addedSelectState);
        setLoading(false);
      })
      .catch((e) => {
        isFetchingData.current = false;
        setLoading(false);
        if (navigation.isFocused()) {
          setTimeout(() => {
            deviceUtils.showErrorToast(e, 'msg__engine__internal_error');
          }, 200);
        }

        navigation?.goBack?.();
        navigation?.goBack?.();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    refreshTimestamp,
    config.fromIndex,
    config.generateCount,
    config.currentPage,
    isBatchMode,
    navigation,
    network,
    password,
    purpose,
    walletId,
  ]);

  const checkBoxOnChange = useCallback(
    (isSelected: boolean, item: RecoverAccountType): boolean => {
      const newSelectState = new Map(selectState);
      const state = newSelectState.get(item.index);
      if (!state?.isDisabled) {
        newSelectState.set(item.index, {
          isDisabled: false,
          selected: isSelected,
        });
        setSelectState(newSelectState);
      }
      return true;
    },
    [selectState],
  );

  const onRefreshCheckBox = useCallback(
    (selectedAll: boolean) => {
      const newSelectState = new Map(selectState);

      const start = config.currentPage * PAGE_SIZE + config.fromIndex - 1;
      for (let index = start; index < start + PAGE_SIZE; index += 1) {
        const state = newSelectState.get(index);
        if (!!state && !state.isDisabled) {
          newSelectState.set(index, {
            isDisabled: false,
            selected: selectedAll,
          });
        }
      }

      setSelectState(newSelectState);
    },
    [config.fromIndex, config.currentPage, selectState],
  );

  useEffect(() => {
    let selectAll = selectState.size > 0;
    let verify = false;
    selectState.forEach((value, index) => {
      if (!verify && !value.isDisabled && value.selected) {
        verify = true;
      }
      const start = config.currentPage * PAGE_SIZE + config.fromIndex - 1;
      if (index >= start && index < start + PAGE_SIZE) {
        if (selectAll && !value.isDisabled && !value.selected) {
          selectAll = false;
        }
      }
    });
    setAllSelected(selectAll);
    setIsValid(verify);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.currentPage, selectState]);

  const rowRenderer = useCallback(
    ({ item }: ListRenderItemInfo<RecoverAccountType>) => (
      <AccountCell
        decimal={decimal}
        showPathAndLink={config.showPathAndLink}
        flex={1}
        item={item}
        state={selectState.get(item.index)}
        onChange={(selected) => {
          checkBoxOnChange(selected, item);
        }}
        openBlockExplorer={openAddressDetails}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkBoxOnChange, config.showPathAndLink],
  );

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

    return (
      config.currentPage === Math.ceil(config.generateCount / PAGE_SIZE) - 1
    );
  }, [
    config.fromIndex,
    config.generateCount,
    config.currentPage,
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

        const recoverAccounts: RecoverAccountConfirmType[] = [];
        loadedAccounts.forEach((value, index) => {
          const state = selectState.get(index);
          recoverAccounts.push({
            ...value,
            isDisabled: state?.isDisabled ?? false,
            selected: state?.selected ?? false,
          });
        });

        navigation.navigate(CreateAccountModalRoutes.RecoverAccountsConfirm, {
          accounts: recoverAccounts,
          walletId,
          network,
          purpose,
          existingAccounts: activeAccounts.current,
          config: {
            ...config,
            generateCount: Math.min(
              realGenerateCount,
              config.generateCount ?? 0,
            ),
          },
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
      {isLoading ? (
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
                  setRefreshTimestamp(getTimeStamp());
                }}
              />
            </Center>
          ) : (
            <List
              data={currentPageData}
              showDivider
              renderItem={rowRenderer}
              keyExtractor={(item: RecoverAccountType) => `${item.index}`}
              extraData={isAllSelected}
            />
          )}
          <ListTableFooter
            minLimit={config.fromIndex}
            count={config.generateCount}
            prevButtonDisabled={config.currentPage === 0}
            nextButtonDisabled={isMaxPage}
            onPrevPagePress={() => {
              setConfig((prev) => {
                if (prev.currentPage === 0) return prev;
                return {
                  ...prev,
                  currentPage: prev.currentPage - 1,
                };
              });
            }}
            onNextPagePress={() => {
              setConfig((prev) => {
                if (isMaxPage) return prev;
                return {
                  ...prev,
                  currentPage: prev.currentPage + 1,
                };
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

                      const newConfig = {
                        currentPage: isForceRefresh ? 0 : config.currentPage,
                        fromIndex,
                        generateCount: count,
                        showPathAndLink: showPath,
                      };

                      if (isForceRefresh) {
                        setSelectState(new Map());
                        setLoadedAccounts(new Map());
                      }

                      setRealGenerateCount(Number.MAX_VALUE);
                      setConfig(newConfig);
                    }, 100);
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

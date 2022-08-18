import React, {
  ComponentProps,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Center,
  CheckBox,
  Divider,
  Empty,
  Modal,
  Spinner,
  Typography,
} from '@onekeyhq/components';
import type {
  Account,
  ImportableHDAccount,
} from '@onekeyhq/engine/src/types/account';
import IconAccount from '@onekeyhq/kit/assets/3d_account.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import { deviceUtils } from '../../../utils/hardware';

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
  index: number;
  onChange: (v: boolean, callback: (success: boolean) => void) => void;
} & ComponentProps<typeof Box>;

const CustomCell: FC<CellProps> = ({ item, index, onChange }) => {
  const [isChecked, setIsCheck] = useState(item.selected);
  return (
    <Box
      key={item.path}
      flexDirection="row"
      height="100px"
      bgColor="surface-default"
      justifyContent="space-between"
      borderTopRadius={index === 0 ? '12px' : 0}
    >
      <Box
        flexDirection="column"
        flex={1}
        justifyContent="center"
        paddingLeft="16px"
      >
        <Typography.Body1Strong>{item.displayAddress}</Typography.Body1Strong>
        <Typography.Body2 color="text-subdued">{item.path}</Typography.Body2>
      </Box>
      <Box width="60px" height="100%" justifyContent="center" pl="24px">
        <CheckBox
          isChecked={isChecked}
          isDisabled={item.isDisabled}
          onChange={(isSelected) => {
            if (!item.isDisabled && onChange) {
              onChange(isSelected, (success) => {
                if (success) {
                  setIsCheck(isSelected);
                }
              });
            }
          }}
        />
      </Box>
      <Box />
    </Box>
  );
};

type PageStatusType = 'loading' | 'empty' | 'data';
const RecoverAccounts: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { password, walletId, network, purpose, onLoadingAccount } =
    route.params;
  const [currentPage, setCurrentPage] = useState(0);
  const [searchEnded, setSearchEnded] = useState(false);
  const [pageStatus, setPageStatus] = useState<PageStatusType>('loading');
  const navigation = useNavigation<NavigationProps['navigation']>();

  const [flatListData, updateFlatListData] = useState<FlatDataType[]>([]);
  const { wallets } = useRuntime();

  const wallet = wallets.find((w) => w.id === walletId) ?? null;

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
    (page: number, pageSize: number) => {
      isFetchingData.current = true;
      const limit = pageSize;
      const start = page * limit;
      backgroundApiProxy.engine
        .searchHDAccounts(walletId, network, password, start, limit, purpose)
        .then((accounts) => {
          if (currentPage === 0) {
            setPageStatus(accounts.length > 0 ? 'data' : 'empty');
          }
          // For BIP-44 compliance, if number of accounts is less than that we
          // required, stop searching for more accounts.
          setSearchEnded(accounts.length < limit);
          isFetchingData.current = false;
          updateFlatListData((prev) =>
            prev.concat(
              accounts.map((item) => {
                const isDisabled = activeAccounts.current.some(
                  (a) => a.path === item.path,
                );
                return { ...item, selected: isDisabled, isDisabled };
              }),
            ),
          );
        })
        .catch((e: any) => {
          const { code } = e || {};
          if (code === HardwareErrorCode.DeviceInterruptedFromOutside) {
            return;
          }

          isFetchingData.current = false;

          deviceUtils.showErrorToast(e);

          navigation?.goBack?.();
          navigation?.goBack?.();
        });
    },
    [currentPage, network, password, walletId, navigation, purpose],
  );

  const checkBoxOnChange = useCallback(
    (isSelected: boolean, item: FlatDataType): boolean => {
      flatListData.some((i) => {
        if (i.path === item.path) {
          i.selected = isSelected;
          return true;
        }
        return false;
      });
      setIsValid(flatListData.some((i) => !i.isDisabled && i.selected));
      return true;
    },
    [flatListData],
  );

  const renderItem: ListRenderItem<FlatDataType> = useCallback(
    ({ item, index }) => (
      <CustomCell
        item={item}
        index={index}
        borderBottomRadius={index === flatListData.length - 1 ? '12px' : 0}
        onChange={(isSelected, callback) => {
          callback(checkBoxOnChange(isSelected, item));
        }}
      />
    ),
    [checkBoxOnChange, flatListData.length],
  );

  const pageSize = 10;
  const needGetMoreData =
    flatListData.length <= currentPage * pageSize && !searchEnded;

  useEffect(() => {
    if (needGetMoreData) {
      obj.p.then(() => {
        getData(currentPage, pageSize);
      });
    }
  }, [currentPage, getData, needGetMoreData, obj]);

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

  const flatlistProps = useMemo(
    () =>
      pageStatus === 'data'
        ? {
            height: '640px',
            data: flatListData,
            // @ts-ignore
            renderItem,
            ItemSeparatorComponent: () => <Divider />,
            keyExtractor: (item: ImportableHDAccount) => item.path,
            ListFooterComponent: searchEnded
              ? undefined
              : () => (
                  <Box pt="20px">
                    <Spinner size="sm" />
                  </Box>
                ),
            onEndReached: () => {
              /**
               * Prevent duplicate loading to cause hardware error
               */
              if (isFetchingData.current) return;
              setCurrentPage((p) => p + 1);
            },
          }
        : undefined,
    [flatListData, pageStatus, renderItem, searchEnded],
  );

  return (
    <Modal
      height="640px"
      header={intl.formatMessage({ id: 'action__recover_accounts' })}
      headerDescription={`${intl.formatMessage({
        id: 'account__recover_Step_1_of_2',
      })}`}
      onBackActionPress={() => {
        navigation.navigate(CreateAccountModalRoutes.CreateAccountForm, {
          walletId,
        });
      }}
      primaryActionTranslationId="action__next"
      onPrimaryActionPress={() => {
        hardwareCancel();
        navigation.navigate(CreateAccountModalRoutes.RecoverAccountsConfirm, {
          accounts: flatListData.filter((i) => !i.isDisabled && i.selected),
          walletId,
          network,
          purpose,
          onLoadingAccount,
        });
      }}
      primaryActionProps={{
        isDisabled: !isValid,
      }}
      hideSecondaryAction
      // @ts-ignore
      flatListProps={flatlistProps}
      mt="10px"
    >
      {pageStatus !== 'data' ? (
        <Center h="full" w="full">
          {pageStatus === 'empty' ? (
            <Empty
              imageUrl={IconAccount}
              title={intl.formatMessage({
                id: 'empty__no_account_title',
              })}
              subTitle={intl.formatMessage({
                id: 'empty__no_recoverable_account_desc',
              })}
            />
          ) : (
            <Spinner size="lg" />
          )}
        </Center>
      ) : null}
    </Modal>
  );
};

export default RecoverAccounts;

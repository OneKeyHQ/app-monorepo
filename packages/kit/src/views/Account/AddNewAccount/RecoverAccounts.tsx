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

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  CheckBox,
  DataProvider,
  Divider,
  Empty,
  LayoutProvider,
  Modal,
  Pressable,
  RecyclerListView,
  Spinner,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { FormatBalance } from '../../../components/Format';
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
  decimal: number;
  symbol: string;
  onChange: (v: boolean, callback: (success: boolean) => void) => void;
} & ComponentProps<typeof Box>;

const AccountCell: FC<CellProps> = ({
  item,
  index,
  onChange,
  decimal,
  symbol,
}) => {
  const [isChecked, setIsCheck] = useState(item.selected);

  const onPress = useCallback(() => {
    if (!item.isDisabled && onChange) {
      onChange(!isChecked, (success) => {
        if (success) {
          setIsCheck(!isChecked);
        }
      });
    }
  }, [isChecked, item.isDisabled, onChange]);

  return (
    <Pressable
      onPress={platformEnv.isNative ? onPress : undefined}
      flexDirection="row"
      height="72px"
      bgColor="surface-default"
      borderTopRadius={index === 0 ? '12px' : 0}
      padding="16px"
      flex={1}
    >
      <CheckBox
        isChecked={isChecked}
        isDisabled={item.isDisabled}
        onChange={onPress}
      />
      <Box flexDirection="row" justifyContent="space-between" flex={1}>
        <Box flexDirection="column" justifyContent="center" paddingX="16px">
          <Typography.Body2>
            {shortenAddress(item.displayAddress)}
          </Typography.Body2>
          <Typography.Body2 color="text-subdued">{item.path}</Typography.Body2>
        </Box>
        <FormatBalance
          balance={item.mainBalance}
          suffix={symbol}
          formatOptions={{
            fixed: decimal ?? 4,
          }}
          render={(ele) => <Typography.Body2>{ele}</Typography.Body2>}
        />
      </Box>
    </Pressable>
  );
};

const RecoverAccounts: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { password, walletId, network, purpose, onLoadingAccount } =
    route.params;
  const bgColor = useThemeValue('surface-default');

  const [currentPage, setCurrentPage] = useState(0);
  const [searchEnded, setSearchEnded] = useState(false);
  const navigation = useNavigation<NavigationProps['navigation']>();

  const [flatListData, updateFlatListData] = useState<FlatDataType[]>([]);
  const { wallets, networks } = useRuntime();
  const [pageWidth, setPageWidth] = useState<number>(0);
  const selectedNetWork = networks.filter((n) => n.id === network)[0];
  const decimal = selectedNetWork?.nativeDisplayDecimals;
  const symbol = selectedNetWork?.symbol;

  const wallet = wallets.find((w) => w.id === walletId) ?? null;

  const [isLoading, setLoading] = useState(true);
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
            setLoading(false);
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

          setTimeout(() => {
            deviceUtils.showErrorToast(e);
          }, 200);

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

  const dataProvider = useMemo(
    () => new DataProvider((r1, r2) => r1 !== r2).cloneWithRows(flatListData),
    [flatListData],
  );

  const layoutProvider = useMemo(
    () =>
      new LayoutProvider(
        () => 'item',
        (_, dim) => {
          dim.width = pageWidth - 32;
          dim.height = 73;
        },
      ),
    [pageWidth],
  );

  const rowRenderer = useCallback(
    (type, item, index: number) => (
      <Box flex={1}>
        <AccountCell
          symbol={symbol}
          decimal={decimal}
          flex={1}
          item={item}
          index={index}
          onChange={(isSelected, callback) => {
            callback(checkBoxOnChange(isSelected, item));
          }}
        />
        <Divider />
      </Box>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkBoxOnChange],
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

  return (
    <Modal
      height="640px"
      header={intl.formatMessage({ id: 'action__recover_accounts' })}
      headerDescription={`${intl.formatMessage({
        id: 'account__recover_Step_1_of_2',
      })}`}
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
      staticChildrenProps={{
        flex: 1,
        padding: '16px',
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
      ) : flatListData.length === 0 ? (
        <Center flex={1}>
          <Empty
            imageUrl={IconAccount}
            title={intl.formatMessage({
              id: 'empty__no_account_title',
            })}
            subTitle={intl.formatMessage({
              id: 'empty__no_recoverable_account_desc',
            })}
          />
        </Center>
      ) : (
        <RecyclerListView
          flex={1}
          style={{ borderRadius: 12, backgroundColor: bgColor }}
          dataProvider={dataProvider}
          layoutProvider={layoutProvider}
          rowRenderer={rowRenderer}
          disableRecycling
          renderFooter={
            searchEnded || currentPage === 0
              ? undefined
              : () => (
                  <Box my="24px">
                    <Spinner size="sm" />
                  </Box>
                )
          }
          onEndReached={() => {
            /**
             * Prevent duplicate loading to cause hardware error
             */
            if (isFetchingData.current) return;
            setCurrentPage((p) => p + 1);
          }}
        />
      )}
    </Modal>
  );
};

export default RecoverAccounts;

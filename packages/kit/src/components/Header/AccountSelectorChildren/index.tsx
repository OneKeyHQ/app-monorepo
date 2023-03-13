import type { FC } from 'react';
import { memo, useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  IconButton,
  VStack,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useDebounce } from '@onekeyhq/kit/src/hooks';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';
import useRemoveAccountDialog from '@onekeyhq/kit/src/views/ManagerAccount/RemoveAccount';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { LazyDisplayView } from '../../LazyDisplayView';

import {
  ACCOUNT_SELECTOR_EMPTY_VIEW_SELECTED_WALLET_DEBOUNCED,
  ACCOUNT_SELECTOR_EMPTY_VIEW_SHOW_DELAY,
} from './accountSelectorConsts';
import LeftSide from './LeftSide';
import RightAccountCreateButton from './RightAccountCreateButton';
import RightAccountEmptyPanel from './RightAccountEmptyPanel';
import RightAccountSection, {
  AccountSectionLoadingSkeleton,
} from './RightAccountSection';
import RightChainSelector from './RightChainSelector';
import RightHeader from './RightHeader';

import type { useAccountSelectorInfo } from '../../NetworkAccountSelector/hooks/useAccountSelectorInfo';

export type AccountType = 'hd' | 'hw' | 'imported' | 'watching';
export type DeviceStatusType = {
  isConnected: boolean;
  hasUpgrade: boolean;
};

export type IAccountSelectorChildrenProps = {
  isOpen?: boolean;
  // eslint-disable-next-line react/no-unused-prop-types
  toggleOpen?: (...args: any) => any;
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
};
const AccountSelectorChildren: FC<IAccountSelectorChildrenProps> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isOpen,
  accountSelectorInfo,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { bottom } = useSafeAreaInsets();
  const { RemoveAccountDialog } = useRemoveAccountDialog();

  const { serviceAccountSelector, serviceAccount } = backgroundApiProxy;
  const { account: currentActiveAccount, network: currentActiveNetwork } =
    useActiveWalletAccount();
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  const {
    selectedWallet,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    selectedWalletId,
    selectedNetwork,
    selectedNetworkId,

    devicesStatus,

    isLoading,
    isOpenDelay,
    isOpenDelayForShow,
    isAccountsGroupEmpty,
    preloadingCreateAccount,

    accountsGroup,
    // ** for rename/update/remove account
    refreshAccounts,
  } = accountSelectorInfo;

  // ** for creating new account
  // serviceAccountSelector.preloadingCreateAccount
  // serviceAccountSelector.preloadingCreateAccountDone

  const onLock = useCallback(() => {
    backgroundApiProxy.serviceApp.lock(true);
  }, []);

  const selectedWalletDeBounced = useDebounce(
    selectedWallet,
    ACCOUNT_SELECTOR_EMPTY_VIEW_SELECTED_WALLET_DEBOUNCED,
  );

  const loadingSkeletonRef = useRef(
    <Box>
      <AccountSectionLoadingSkeleton isLoading />
      {/* <AccountSectionLoadingSkeleton isLoading /> */}
      {/* <AccountSectionLoadingSkeleton isLoading /> */}
    </Box>,
  );
  const isSelectorVisibleAndReady = useMemo(
    () => Boolean(isOpenDelay && isOpenDelayForShow && selectedWalletId),
    [isOpenDelay, isOpenDelayForShow, selectedWalletId],
  );
  const rightContent = useMemo(() => {
    if (isAccountsGroupEmpty) {
      if (isLoading) {
        return loadingSkeletonRef.current;
      }
      if (!isSelectorVisibleAndReady) {
        return loadingSkeletonRef.current;
      }
      return (
        <LazyDisplayView
          hideOnUnmount
          delay={ACCOUNT_SELECTOR_EMPTY_VIEW_SHOW_DELAY}
        >
          <RightAccountEmptyPanel
            activeWallet={selectedWalletDeBounced}
            // activeWallet={selectedWallet}
            selectedNetworkId={selectedNetworkId}
          />
        </LazyDisplayView>
      );
    }
    return (
      <RightAccountSection
        activeAccounts={accountsGroup}
        activeWallet={selectedWallet}
        selectedNetwork={selectedNetwork}
        activeNetwork={currentActiveNetwork}
        activeAccount={currentActiveAccount}
        refreshAccounts={refreshAccounts}
      />
    );
  }, [
    selectedNetwork,
    isAccountsGroupEmpty,
    accountsGroup,
    selectedWallet,
    currentActiveNetwork,
    currentActiveAccount,
    refreshAccounts,
    isLoading,
    isSelectorVisibleAndReady,
    selectedWalletDeBounced,
    selectedNetworkId,
  ]);

  return (
    <>
      <LeftSide
        selectedWallet={selectedWallet}
        setSelectedWallet={(w) =>
          serviceAccountSelector.updateSelectedWallet(w?.id)
        }
        deviceStatus={devicesStatus}
      />
      <VStack flex={1} pb={`${isVerticalLayout ? bottom : 0}px`}>
        <RightHeader
          selectedWallet={selectedWallet}
          deviceStatus={
            devicesStatus?.[selectedWallet?.associatedDevice ?? ''] ?? undefined
          }
        />
        <Box
          testID="AccountSelectorChildren-RightChainSelector-Container"
          m={2}
        >
          <RightChainSelector
            activeWallet={selectedWallet}
            selectedNetworkId={selectedNetworkId}
            setSelectedNetworkId={(id) =>
              serviceAccountSelector.updateSelectedNetwork(id)
            }
          />
        </Box>
        <Box flex={1}>{rightContent}</Box>
        {platformEnv.isDev && (
          <Button
            size="xs"
            mx={2}
            onPress={async () => {
              // dispatch(
              //   changeActiveAccount({
              //     activeAccountId: "hd-1--m/44'/60'/0'/0/1",
              //     activeWalletId: 'hello-world-0000',
              //   }),
              // );
              console.log({
                accountsGroup,
                selectedWallet,
                selectedNetwork,
              });

              console.log(
                'getDBAccountByAddress',
                await serviceAccount.getDBAccountByAddress({
                  address: accountsGroup?.[0]?.data?.[0]?.address,
                }),
              );
            }}
          >
            ShowLog
          </Button>
        )}
        <Box p={2} flexDirection="row">
          <Box flex="1">
            <RightAccountCreateButton
              isLoading={!!preloadingCreateAccount}
              activeNetwork={currentActiveNetwork}
              selectedNetworkId={selectedNetworkId}
              activeWallet={selectedWallet}
            />
          </Box>
          {isPasswordSet ? (
            <IconButton
              ml="3"
              name="LockClosedOutline"
              size="lg"
              minW="50px"
              minH="50px"
              onPress={onLock}
            />
          ) : null}
        </Box>
      </VStack>
      {RemoveAccountDialog}
    </>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AccountSelectorChildrenLazy(props: IAccountSelectorChildrenProps) {
  // TODO isOpenDelay or react-native-interactions
  const { isOpen } = props;
  if (isOpen) {
    return <AccountSelectorChildren {...props} />;
  }
  return null;
}

export default memo(AccountSelectorChildren);

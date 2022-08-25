import React, { FC, memo, useCallback, useMemo, useRef } from 'react';

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
  ACCOUNT_SELECTOR_EMPTY_VIEW_SHOW_DELAY,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ACCOUNT_SELECTOR_SELECTED_WALLET_DEBOUNCED,
} from './accountSelectorConsts';
import LeftSide from './LeftSide';
import RightAccountCreateButton from './RightAccountCreateButton';
import RightAccountEmptyPanel from './RightAccountEmptyPanel';
import RightAccountSection, {
  AccountSectionLoadingSkeleton,
} from './RightAccountSection';
import RightChainSelector from './RightChainSelector';
import RightHeader from './RightHeader';
import { useAccountSelectorInfo } from './useAccountSelectorInfo';

export type AccountType = 'hd' | 'hw' | 'imported' | 'watching';
export type DeviceStatusType = {
  isConnected: boolean;
  hasUpgrade: boolean;
};

export type IAccountSelectorChildrenProps = {
  isOpen?: boolean;
  // eslint-disable-next-line react/no-unused-prop-types
  toggleOpen?: (...args: any) => any;
};
const AccountSelectorChildren: FC<IAccountSelectorChildrenProps> = ({
  isOpen,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { bottom } = useSafeAreaInsets();
  const { RemoveAccountDialog } = useRemoveAccountDialog();

  const { serviceAccountSelector } = backgroundApiProxy;
  const { account: currentActiveAccount, network: currentActiveNetwork } =
    useActiveWalletAccount();
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  const {
    selectedWallet,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    selectedWalletId,
    selectedNetwork,
    selectedNetworkId,

    deviceStatus,

    isLoading,
    isOpenDelay,
    isOpenDelayForShow,
    isAccountsGroupEmpty,
    preloadingCreateAccount,

    accountsGroup,
    // ** for rename/update/remove account
    refreshAccounts,
  } = useAccountSelectorInfo({ isOpen });

  // ** for creating new account
  // serviceAccountSelector.preloadingCreateAccount
  // serviceAccountSelector.preloadingCreateAccountDone

  const onLock = useCallback(() => {
    backgroundApiProxy.serviceApp.lock(true);
  }, []);

  // const selectedWalletDeBounced = useDebounce(
  //   selectedWallet,
  //   ACCOUNT_SELECTOR_SELECTED_WALLET_DEBOUNCED,
  // );

  const loadingSkeletonRef = useRef(
    <Box>
      <AccountSectionLoadingSkeleton isLoading />
      {/* <AccountSectionLoadingSkeleton isLoading /> */}
      {/* <AccountSectionLoadingSkeleton isLoading /> */}
    </Box>,
  );
  const rightContent = useMemo(() => {
    if (!isOpenDelay || !isOpenDelayForShow) {
      return loadingSkeletonRef.current;
    }

    if (isAccountsGroupEmpty) {
      if (isLoading) {
        return loadingSkeletonRef.current;
      }
      return (
        <LazyDisplayView delay={ACCOUNT_SELECTOR_EMPTY_VIEW_SHOW_DELAY}>
          <RightAccountEmptyPanel
            // activeWallet={selectedWalletDeBounced}
            activeWallet={selectedWallet}
            selectedNetworkId={selectedNetworkId}
          />
        </LazyDisplayView>
      );
    }
    return (
      <RightAccountSection
        activeAccounts={accountsGroup}
        activeWallet={selectedWallet}
        activeNetwork={currentActiveNetwork}
        activeAccount={currentActiveAccount}
        refreshAccounts={refreshAccounts}
      />
    );
  }, [
    isOpenDelay,
    isOpenDelayForShow,
    isAccountsGroupEmpty,
    accountsGroup,
    selectedWallet,
    currentActiveNetwork,
    currentActiveAccount,
    refreshAccounts,
    isLoading,
    selectedNetworkId,
  ]);

  return (
    <>
      <LeftSide
        selectedWallet={selectedWallet}
        setSelectedWallet={(w) =>
          serviceAccountSelector.updateSelectedWallet(w?.id)
        }
        deviceStatus={deviceStatus}
      />
      <VStack flex={1} pb={`${isVerticalLayout ? bottom : 0}px`}>
        <RightHeader
          selectedWallet={selectedWallet}
          deviceStatus={
            deviceStatus?.[selectedWallet?.associatedDevice ?? ''] ?? undefined
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
            onPress={() => {
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
            }}
          >
            Show
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
              name="LockOutline"
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

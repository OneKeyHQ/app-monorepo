import { useCallback, useEffect, useMemo } from 'react';

import { StyleSheet } from 'react-native';

import {
  Page,
  SortableListView,
  Stack,
  XStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorFocusedWallet } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { analytics } from '@onekeyhq/shared/src/analytics';
import { emptyArray } from '@onekeyhq/shared/src/consts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useAccountSelectorRoute } from '../../../router/useAccountSelectorRoute';

import { AccountSelectorCreateWalletButton } from './AccountSelectorCreateWalletButton';
import { WalletListItem } from './WalletListItem';

interface IWalletListProps {
  num: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function OthersWalletItem({
  onWalletPress,
  num,
}: {
  num: number;
  onWalletPress: (focusedWallet: IAccountSelectorFocusedWallet) => void;
}) {
  const {
    selectedAccount: { focusedWallet },
  } = useSelectedAccount({ num });
  return (
    <WalletListItem
      isOthers
      wallet={undefined}
      focusedWallet={focusedWallet}
      onWalletPress={onWalletPress}
    />
  );
}

export function AccountSelectorWalletListSideBarPerfTest({
  num,
}: IWalletListProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const actions = useAccountSelectorActions(); // make render twice first time
  const { selectedAccount } = useSelectedAccount({ num }); // make render twice first time

  defaultLogger.accountSelector.perf.renderWalletListSideBar({
    selectedAccount: {} as any,
    walletsCount: 0,
  });
  return null;
}

export function AccountSelectorWalletListSideBar({ num }: IWalletListProps) {
  const { serviceAccount } = backgroundApiProxy;
  const { bottom } = useSafeAreaInsets();
  const actions = useAccountSelectorActions();
  const route = useAccountSelectorRoute();
  // const linkNetwork = route.params?.linkNetwork;
  const isEditableRouteParams = route.params?.editable;
  const { selectedAccount } = useSelectedAccount({ num });

  const {
    result: walletsResult,
    setResult,
    run: reloadWallets,
  } = usePromiseResult(
    async () => {
      defaultLogger.accountSelector.perf.buildWalletListSideBarData();
      const r = await serviceAccount.getWallets({
        nestedHiddenWallets: true,
        ignoreEmptySingletonWalletAccounts: true,
      });
      return r;
    },
    [serviceAccount],
    {
      checkIsFocused: false,
    },
  );
  const wallets = walletsResult?.wallets ?? emptyArray;

  defaultLogger.accountSelector.perf.renderWalletListSideBar({
    selectedAccount,
    walletsCount: wallets?.length ?? 0,
  });

  useEffect(() => {
    const walletCount = wallets.length;
    if (walletCount > 0) {
      const hwWalletCount = wallets.filter(
        (wallet) => wallet.type === 'hw',
      ).length;
      const appWalletCount = walletCount - hwWalletCount;
      analytics.updateUserProfile({
        walletCount,
        hwWalletCount,
        appWalletCount,
      });
    }
  }, [wallets]);

  useEffect(() => {
    const fn = async () => {
      await reloadWallets();
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    appEventBus.on(EAppEventBusNames.AccountUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
      appEventBus.off(EAppEventBusNames.AccountUpdate, fn);
    };
  }, [reloadWallets]);

  const onWalletPress = useCallback(
    (focusedWallet: IAccountSelectorFocusedWallet) => {
      void actions.current.updateSelectedAccountFocusedWallet({
        num,
        focusedWallet,
      });
    },
    [actions, num],
  );

  const CELL_HEIGHT = 68;

  const layoutList = useMemo(() => {
    let offset = 0;
    const layouts: { offset: number; length: number; index: number }[] = [];
    wallets?.forEach?.((wallet) => {
      const hiddenWalletsLength = wallet?.hiddenWallets?.length ?? 0;
      const height = (1 + hiddenWalletsLength) * (CELL_HEIGHT + 12);
      layouts.push({ offset, length: height, index: layouts.length });
      offset += height;
      if (hiddenWalletsLength > 0) {
        offset += 2;
      }
    });
    return layouts;
  }, [wallets, CELL_HEIGHT]);

  const { md } = useMedia();

  const isShowCloseButton = md && !platformEnv.isNativeIOS;
  return (
    <Stack
      testID="account-selector-wallet-list"
      w="$24"
      $gtMd={{
        w: '$32',
      }}
      bg="$bgSubdued"
      borderRightWidth={StyleSheet.hairlineWidth}
      borderRightColor="$neutral3"
    >
      {/* Close action */}
      {isShowCloseButton ? (
        <XStack
          py="$4"
          justifyContent="center"
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$neutral3"
        >
          <Page.Close>
            <HeaderIconButton icon="CrossedLargeOutline" />
          </Page.Close>
        </XStack>
      ) : null}
      {/* Primary wallets */}
      <SortableListView
        px="$2"
        contentContainerStyle={{ py: '$2' }}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => layoutList[index]}
        renderPlaceholder={({ item }) => (
          <Stack
            h={
              (1 + (item?.hiddenWallets?.length ?? 0)) * CELL_HEIGHT +
              (item?.hiddenWallets?.length ?? 0) * 12
            }
            mx="$2"
            bg="$bgActive"
            p="$1"
            borderRadius="$3"
            borderCurve="continuous"
          />
        )}
        keyExtractor={(item) => `${item.id}`}
        data={wallets as IDBWallet[]}
        onDragEnd={async (result) => {
          if (!walletsResult) {
            return;
          }
          walletsResult.wallets = result.data;
          setResult({ ...walletsResult });

          const toIndex = result.to + (result.to > result.from ? 1 : 0);
          await serviceAccount.insertWalletOrder({
            targetWalletId: wallets[result.from].id,
            startWalletId: wallets[toIndex - 1]?.id,
            endWalletId: wallets[toIndex]?.id,
            emitEvent: true,
          });
        }}
        extraData={selectedAccount.focusedWallet}
        renderItem={({ item, drag, dragProps }) => {
          let badge: number | string | undefined;
          if (accountUtils.isQrWallet({ walletId: item.id })) {
            badge = 'QR';
          }

          return (
            <Stack pb="$3" dataSet={dragProps}>
              <WalletListItem
                key={item.id}
                wallet={item}
                focusedWallet={selectedAccount.focusedWallet}
                onWalletPress={onWalletPress}
                onWalletLongPress={drag}
                testID={`wallet-${item.id}`}
                badge={badge}
              />
            </Stack>
          );
        }}
      />
      {/* Others */}
      {isEditableRouteParams ? (
        <Stack
          p="$2"
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor="$borderSubdued"
          mb={bottom}
        >
          <AccountSelectorCreateWalletButton />
          {/* <OthersWalletItem onWalletPress={onWalletPress} num={num} /> */}
        </Stack>
      ) : null}
    </Stack>
  );
}

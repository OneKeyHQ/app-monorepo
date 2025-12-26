import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce, noop } from 'lodash';
import { StyleSheet } from 'react-native';

import type { ISortableListViewRef } from '@onekeyhq/components';
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
import {
  useAccountSelectorStatusAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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

import type { IAccountSelectorWalletInfo } from '../../../type';

interface IWalletListProps {
  num: number;
  hideNonBackedUpWallet?: boolean;
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
  const { selectedAccount: _selectedAccount } = useSelectedAccount({ num }); // make render twice first time

  defaultLogger.accountSelector.perf.renderWalletListSideBar({
    selectedAccount: {} as any,
    walletsCount: 0,
  });
  return null;
}

export function AccountSelectorWalletListSideBar({
  num,
  hideNonBackedUpWallet,
}: IWalletListProps) {
  const { serviceAccount } = backgroundApiProxy;
  const { bottom, top } = useSafeAreaInsets();
  const actions = useAccountSelectorActions();
  const route = useAccountSelectorRoute();
  // const linkNetwork = route.params?.linkNetwork;
  const isEditableRouteParams = route.params?.editable;
  const { selectedAccount } = useSelectedAccount({ num });
  const focusWalletChanged = useRef<boolean>(false);

  const [layoutRefreshTS, setLayoutRefreshTS] = useState(0);
  useEffect(() => {
    const fn = debounce(
      () => {
        setLayoutRefreshTS((ts) => ts + 1);
      },
      600,
      {
        leading: false,
        trailing: true,
      },
    );
    appEventBus.on(EAppEventBusNames.HardwareFeaturesUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.HardwareFeaturesUpdate, fn);
    };
  }, []);
  const [accountSelectorStatus] = useAccountSelectorStatusAtom();
  const reloadWalletsHook = `${layoutRefreshTS}-${
    accountSelectorStatus?.passphraseProtectionChangedAt ?? 0
  }`;

  const {
    result: walletsResult,
    setResult,
    run: reloadWallets,
  } = usePromiseResult<
    | {
        wallets: IAccountSelectorWalletInfo[];
      }
    | undefined
  >(
    async () => {
      noop(reloadWalletsHook);
      defaultLogger.accountSelector.perf.buildWalletListSideBarData();
      const r = await serviceAccount.getWallets({
        nestedHiddenWallets: true,
        ignoreEmptySingletonWalletAccounts: true,
        ignoreNonBackedUpWallets: hideNonBackedUpWallet,
      });

      const wallets = r.wallets.map((wallet) => {
        const isQrWallet = accountUtils.isQrWallet({
          walletId: wallet.id,
        });

        const badge = isQrWallet ? 'QR' : undefined;

        return {
          ...wallet,
          badge,
        };
      });

      return {
        wallets,
      };
    },
    [serviceAccount, hideNonBackedUpWallet, reloadWalletsHook],
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
    if (
      walletsResult?.wallets &&
      hideNonBackedUpWallet &&
      !focusWalletChanged.current
    ) {
      const backedUpWalletsMap = walletsResult.wallets.reduce((acc, wallet) => {
        acc[wallet.id] = wallet;
        wallet.hiddenWallets?.forEach((hiddenWallet) => {
          acc[hiddenWallet.id] = hiddenWallet;
        });
        return acc;
      }, {} as Record<string, IDBWallet>);

      if (
        !backedUpWalletsMap[selectedAccount.focusedWallet ?? ''] &&
        !backedUpWalletsMap[selectedAccount.walletId ?? '']
      ) {
        void actions.current.updateSelectedAccountFocusedWallet({
          num,
          focusedWallet: walletsResult.wallets[0]?.id,
        });
      }

      focusWalletChanged.current = true;
    }
  }, [
    walletsResult?.wallets,
    actions,
    num,
    selectedAccount,
    hideNonBackedUpWallet,
  ]);

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

  const [settings] = useSettingsPersistAtom();

  const shouldShowCreateHiddenWalletButtonFn = useCallback(
    ({ wallet }: { wallet: IDBWallet | undefined }) => {
      let shouldShowCreateHiddenWalletButton = false;
      noop(reloadWalletsHook);
      if (
        wallet &&
        accountUtils.isHwOrQrWallet({ walletId: wallet.id }) &&
        !accountUtils.isHwHiddenWallet({ wallet }) &&
        isEditableRouteParams &&
        !wallet?.deprecated &&
        settings.showAddHiddenInWalletSidebar
      ) {
        if (
          accountUtils.isHwWallet({
            walletId: wallet.id,
          }) &&
          !accountUtils.isQrWallet({
            walletId: wallet.id,
          }) &&
          (wallet?.associatedDeviceInfo?.featuresInfo?.passphrase_protection ===
            true ||
            (wallet?.hiddenWallets?.length ?? 0) > 0)
        ) {
          shouldShowCreateHiddenWalletButton = true;
        }

        if (
          accountUtils.isQrWallet({
            walletId: wallet.id,
          }) &&
          !accountUtils.isHwWallet({
            walletId: wallet.id,
          }) &&
          (wallet?.hiddenWallets?.length ?? 0) > 0
        ) {
          shouldShowCreateHiddenWalletButton = true;
        }
      }
      return shouldShowCreateHiddenWalletButton;
    },
    [
      isEditableRouteParams,
      settings.showAddHiddenInWalletSidebar,
      reloadWalletsHook,
    ],
  );

  const getHiddenWalletsLength = useCallback(
    (wallet: IDBWallet) => {
      noop(reloadWalletsHook);
      let _hiddenWalletsLength = wallet?.hiddenWallets?.length ?? 0;

      if (shouldShowCreateHiddenWalletButtonFn({ wallet })) {
        _hiddenWalletsLength += 1; // show create hidden wallet button
      }
      return _hiddenWalletsLength;
    },
    [shouldShowCreateHiddenWalletButtonFn, reloadWalletsHook],
  );

  const layoutList = useMemo(() => {
    noop(reloadWalletsHook);
    let offset = 0;
    const layouts: { offset: number; length: number; index: number }[] = [];
    wallets?.forEach?.((wallet) => {
      const hiddenWalletsLength = getHiddenWalletsLength(wallet);
      const height = (1 + hiddenWalletsLength) * (CELL_HEIGHT + 12);
      layouts.push({ offset, length: height, index: layouts.length });
      offset += height;
      if (hiddenWalletsLength > 0) {
        offset += 2;
      }
    });
    return layouts;
  }, [wallets, getHiddenWalletsLength, reloadWalletsHook]);

  const { md } = useMedia();

  const listViewRef =
    useRef<ISortableListViewRef<IAccountSelectorWalletInfo>>(null);

  const isShowCloseButton = md && !platformEnv.isNativeIOS;
  return (
    <Stack
      testID="account-selector-wallet-list"
      w="$24"
      $gtMd={{
        w: '$32',
      }}
      pt={platformEnv.isNativeAndroid ? top : undefined}
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
        useFlashList
        ref={listViewRef}
        contentContainerStyle={{ py: '$2', px: '$2' }}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => layoutList[index]}
        renderPlaceholder={({ item }) => (
          <Stack
            h={(() => {
              const hiddenWalletsLength = getHiddenWalletsLength(item);
              return (
                (1 + hiddenWalletsLength) * CELL_HEIGHT +
                hiddenWalletsLength * 12
              );
            })()}
            mx="$2"
            bg="$bgActive"
            p="$1"
            borderRadius="$3"
            borderCurve="continuous"
          />
        )}
        keyExtractor={(item) => `${item.id}`}
        data={wallets as IAccountSelectorWalletInfo[]}
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
        extraData={[selectedAccount.focusedWallet, reloadWalletsHook]}
        renderItem={({ item, drag, dragProps }) => {
          return (
            <Stack pb="$3" dataSet={dragProps}>
              <WalletListItem
                key={item.id}
                wallet={item}
                focusedWallet={selectedAccount.focusedWallet}
                onWalletPress={onWalletPress}
                onWalletLongPress={drag}
                testID={`wallet-${item.id}`}
                badge={item.badge}
                isEditMode={isEditableRouteParams}
                shouldShowCreateHiddenWalletButtonFn={
                  shouldShowCreateHiddenWalletButtonFn
                }
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
          mb={Math.max(bottom, 8)}
        >
          <AccountSelectorCreateWalletButton />
          {/* <OthersWalletItem onWalletPress={onWalletPress} num={num} /> */}
        </Stack>
      ) : null}
    </Stack>
  );
}

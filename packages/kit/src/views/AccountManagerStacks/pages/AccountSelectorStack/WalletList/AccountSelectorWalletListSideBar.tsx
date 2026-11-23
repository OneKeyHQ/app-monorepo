import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce, noop } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Icon,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { SortableListView } from '@onekeyhq/components/src/layouts/SortableListView';
import type { ISortableListViewRef } from '@onekeyhq/components/src/layouts/SortableListView';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { useHardwareWalletConnectStatus } from '@onekeyhq/kit/src/hooks/useHardwareWalletConnectStatus';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSelectedAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountSelectorFocusedWallet } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import {
  useAccountSelectorStatusAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { emptyArray } from '@onekeyhq/shared/src/consts';
import { BOT_WALLET_STATUS_DEACTIVATED } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import {
  resolveWalletPassphraseProtection,
  shouldShowCreateHiddenWalletSidebarButtonForWallet,
} from '../../../components/WalletEdit/WalletEditButtonUtils';
import { useAccountSelectorRoute } from '../../../router/useAccountSelectorRoute';
import { AccountManagerTestIDs } from '../../../testIDs';

import { AccountSelectorCreateWalletButton } from './AccountSelectorCreateWalletButton';
import { WalletListItem } from './WalletListItem';
import {
  buildGroupedAccountSelectorWallets,
  getWalletChildrenLength,
} from './walletListUtils';

import type { IAccountSelectorWalletInfo } from '../../../type';

interface IWalletListProps {
  num: number;
  hideNonBackedUpWallet?: boolean;
  hideWatchingWallet?: boolean;
  presentation?: 'sidebar' | 'popover';
  walletListOpen?: boolean;
  onWalletListOpenChange?: (open: boolean) => void;
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
  hideWatchingWallet = false,
  presentation = 'sidebar',
  walletListOpen = false,
  onWalletListOpenChange,
}: IWalletListProps) {
  const intl = useIntl();
  const { serviceAccount } = backgroundApiProxy;
  const { bottom, top } = useSafeAreaInsets();
  const actions = useAccountSelectorActions();
  const route = useAccountSelectorRoute();
  // const linkNetwork = route.params?.linkNetwork;
  const isEditableRouteParams = route.params?.editable;
  const { selectedAccount } = useSelectedAccount({ num });
  const focusWalletChanged = useRef<boolean>(false);

  // Detect connected hardware wallets via WebUSB
  // Note: connectedDevices reference is stable - only changes when device list actually changes
  const { isWalletConnected } = useHardwareWalletConnectStatus();

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
    appEventBus.on(EAppEventBusNames.HardwareDeviceStateUpdate, fn);
    appEventBus.on(EAppEventBusNames.HardwareFeaturesUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.HardwareDeviceStateUpdate, fn);
      appEventBus.off(EAppEventBusNames.HardwareFeaturesUpdate, fn);
    };
  }, []);
  const [accountSelectorStatus] = useAccountSelectorStatusAtom();
  const reloadWalletsHook = `${layoutRefreshTS}-${
    accountSelectorStatus?.passphraseProtectionChangedAt ?? 0
  }`;

  // Sidebar SWR cache. Invalidation is handled outside this component:
  //   - Wallet/Account CRUD funnels through WalletUpdate / AccountUpdate
  //     (see ServiceAccount emits) — listeners below call reloadWallets,
  //     which runs the fetcher and overwrites this slot via usePromiseResult.
  //   - OneKey state / third-party features / passphrase toggle flow through
  //     reloadWalletsHook -> useEffect refetch -> same overwrite path.
  //   - Bulk wipes (ServiceApp.resetApp, ServiceE2E.clearWalletsAndAccounts)
  //     clear the cold-start cache in the bg service before emitting the
  //     wipe event, so this hook reads an empty MMKV on next mount.
  const walletsSwrKey = swrKeys.walletListSideBar({ hideNonBackedUpWallet });

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

      const botWalletEntries = await Promise.all(
        r.wallets.map(async (wallet) => {
          const isBotWallet = accountUtils.isBotWallet({ walletId: wallet.id });
          if (!isBotWallet) {
            return {
              wallet,
              isBotWallet,
              isBotDeactivated: false,
            };
          }

          const meta =
            await backgroundApiProxy.serviceAccount.getBotWalletMetadata(
              wallet.id,
            );
          if (!meta?.visible) {
            return null;
          }

          return {
            wallet,
            isBotWallet,
            isBotDeactivated: meta.status === BOT_WALLET_STATUS_DEACTIVATED,
          };
        }),
      );

      const filteredWalletEntries = botWalletEntries.filter(
        (
          entry,
        ): entry is {
          wallet: IDBWallet;
          isBotWallet: boolean;
          isBotDeactivated: boolean;
        } => Boolean(entry),
      );

      const wallets = buildGroupedAccountSelectorWallets(filteredWalletEntries);

      return {
        wallets,
      };
    },
    [serviceAccount, hideNonBackedUpWallet, reloadWalletsHook],
    {
      checkIsFocused: false,
      swrKey: walletsSwrKey,
    },
  );

  const wallets = useMemo(() => {
    const items = walletsResult?.wallets ?? emptyArray;
    return hideWatchingWallet
      ? items.filter(
          (wallet) => !accountUtils.isWatchingWallet({ walletId: wallet.id }),
        )
      : items;
  }, [hideWatchingWallet, walletsResult?.wallets]);

  useEffect(() => {
    if (
      hideWatchingWallet &&
      walletsResult &&
      accountUtils.isWatchingWallet({ walletId: selectedAccount.focusedWallet })
    ) {
      void actions.current.updateSelectedAccountFocusedWallet({
        num,
        focusedWallet: wallets[0]?.id,
        reason: 'hideWatchingWallet',
      });
    }
  }, [
    actions,
    hideWatchingWallet,
    num,
    selectedAccount.focusedWallet,
    wallets,
    walletsResult,
  ]);

  defaultLogger.accountSelector.perf.renderWalletListSideBar({
    selectedAccount,
    walletsCount: wallets?.length ?? 0,
  });

  useEffect(() => {
    if (
      walletsResult?.wallets &&
      hideNonBackedUpWallet &&
      !focusWalletChanged.current
    ) {
      const backedUpWalletsMap = walletsResult.wallets.reduce(
        (acc, wallet) => {
          acc[wallet.id] = wallet;
          wallet.hiddenWallets?.forEach((hiddenWallet) => {
            acc[hiddenWallet.id] = hiddenWallet;
          });
          wallet.botWallets?.forEach((botWallet) => {
            acc[botWallet.id] = botWallet;
          });
          return acc;
        },
        {} as Record<string, IDBWallet>,
      );

      if (
        !backedUpWalletsMap[selectedAccount.focusedWallet ?? ''] &&
        !backedUpWalletsMap[selectedAccount.walletId ?? '']
      ) {
        void actions.current.updateSelectedAccountFocusedWallet({
          num,
          focusedWallet: walletsResult.wallets[0]?.id,
          reason: 'autoRepairFocusedWallet',
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
    async (focusedWallet: IAccountSelectorFocusedWallet) => {
      await actions.current.updateSelectedAccountFocusedWallet({
        num,
        focusedWallet,
        reason: 'userSelectWallet',
      });
    },
    [actions, num],
  );

  const CELL_HEIGHT = 68;

  const [settings] = useSettingsPersistAtom();

  const shouldShowCreateHiddenWalletButtonFn = useCallback(
    ({ wallet }: { wallet: IDBWallet | undefined }) => {
      noop(reloadWalletsHook);
      if (!wallet) return false;
      const deviceInfo = wallet.associatedDeviceInfo;
      return shouldShowCreateHiddenWalletSidebarButtonForWallet({
        isEditableRouteParams: !!isEditableRouteParams,
        showAddHiddenInWalletSidebar: settings.showAddHiddenInWalletSidebar,
        isDeprecated: wallet.deprecated,
        isHiddenWallet: accountUtils.isHwHiddenWallet({ wallet }),
        isHwOrQrWallet: accountUtils.isHwOrQrWallet({ walletId: wallet.id }),
        isHwWallet: accountUtils.isHwWallet({
          walletId: wallet.id,
        }),
        isQrWallet: accountUtils.isQrWallet({
          walletId: wallet.id,
        }),
        hasPassphraseProtection: resolveWalletPassphraseProtection({
          deviceState: deviceInfo?.deviceStateInfo,
          features: deviceInfo?.featuresInfo,
        }),
        hiddenWalletsLength: wallet.hiddenWallets?.length ?? 0,
        vendor: deviceInfo?.vendor,
      });
    },
    [
      isEditableRouteParams,
      settings.showAddHiddenInWalletSidebar,
      reloadWalletsHook,
    ],
  );

  const getHiddenWalletsLength = useCallback(
    (wallet: IAccountSelectorWalletInfo): number => {
      noop(reloadWalletsHook);
      let _hiddenWalletsLength = getWalletChildrenLength(wallet);

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

  // Pre-compute wallet connection status map for stable reference
  const walletConnectionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    wallets.forEach((wallet) => {
      // Deprecated wallets should not show connection status
      if (wallet.deprecated) {
        map.set(wallet.id, false);
        return;
      }
      // Hidden wallets (passphrase wallets) should never show connection status
      if (accountUtils.isHwHiddenWallet({ wallet })) {
        map.set(wallet.id, false);
        return;
      }

      const isHwWallet = accountUtils.isHwWallet({ walletId: wallet.id });
      const isConnected = isHwWallet ? isWalletConnected(wallet) : false;
      map.set(wallet.id, isConnected);
    });
    return map;
  }, [wallets, isWalletConnected]);

  const isShowCloseButton = md && !platformEnv.isNativeIOS;
  const shouldHideWalletList =
    walletsResult !== undefined &&
    wallets.length === 0 &&
    !isEditableRouteParams;

  if (shouldHideWalletList && !walletListOpen) {
    return null;
  }

  if (presentation === 'popover') {
    const options = wallets.flatMap((wallet) => [
      wallet,
      ...(wallet.hiddenWallets ?? []),
      ...(wallet.botWallets ?? []),
    ]);
    const focusedWallet = options.find(
      (wallet) => wallet.id === selectedAccount.focusedWallet,
    );
    if (walletListOpen) {
      return (
        <YStack flex={1} minHeight={0}>
          <Stack px="$5" pt="$3" pb="$2">
            <Button
              testID="reward-account-wallet-back"
              size="small"
              variant="tertiary"
              icon="ArrowLeftOutline"
              alignSelf="flex-start"
              onPress={() => onWalletListOpenChange?.(false)}
            >
              {intl.formatMessage({ id: ETranslations.global_wallet })}
            </Button>
          </Stack>
          <ScrollView flex={1}>
            {options.map((wallet) => (
              <ListItem
                key={wallet.id}
                testID={`reward-account-wallet-${wallet.id}`}
                title={wallet.name}
                titleProps={{ size: '$bodyMdMedium', numberOfLines: 1 }}
                renderAvatar={<WalletAvatar wallet={wallet} size="$6" />}
                onPress={async () => {
                  await onWalletPress(wallet.id);
                  onWalletListOpenChange?.(false);
                }}
              >
                {wallet.id === selectedAccount.focusedWallet ? (
                  <Icon name="CheckRadioSolid" size="$5" color="$iconActive" />
                ) : null}
              </ListItem>
            ))}
          </ScrollView>
        </YStack>
      );
    }
    return (
      <Stack px="$5" pt="$3">
        <XStack
          testID="reward-account-wallet-trigger"
          role="button"
          onPress={() => onWalletListOpenChange?.(true)}
          alignSelf="flex-start"
          maxWidth="100%"
          alignItems="center"
          gap="$2"
          px="$1.5"
          py="$1.5"
          mx="$-1.5"
          borderRadius="$2"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          focusable
          focusVisibleStyle={{
            outlineWidth: 2,
            outlineColor: '$focusRing',
            outlineStyle: 'solid',
          }}
        >
          <WalletAvatar wallet={focusedWallet} size="$5" />
          <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
            {focusedWallet?.name ??
              intl.formatMessage({ id: ETranslations.global_wallet })}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      </Stack>
    );
  }

  return (
    <Stack
      testID={AccountManagerTestIDs.walletList}
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
        keyExtractor={(item) => item.id}
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
        renderItem={({ item, drag, dragProps }) => (
          <Stack pb="$3" dataSet={dragProps}>
            <WalletListItem
              key={item.id}
              wallet={item}
              focusedWallet={selectedAccount.focusedWallet}
              onWalletPress={onWalletPress}
              onWalletLongPress={drag}
              testID={AccountManagerTestIDs.wallet(item.id)}
              badge={item.badge}
              isEditMode={isEditableRouteParams}
              shouldShowCreateHiddenWalletButtonFn={
                shouldShowCreateHiddenWalletButtonFn
              }
              isConnected={walletConnectionMap.get(item.id) ?? false}
            />
          </Stack>
        )}
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

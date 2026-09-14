import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type IdentityRow,
  NativeList,
  type NativeListActionAnchor,
  type NativeListRef,
  type NativeListSnapshot,
  type RowModel,
} from '@onekeyfe/react-native-native-list';
import { debounce, noop } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet, type View } from 'react-native';

import {
  Page,
  Stack,
  Tooltip,
  XStack,
  useMedia,
  useSafeAreaInsets,
  useTheme,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHardwareWalletConnectStatus } from '@onekeyhq/kit/src/hooks/useHardwareWalletConnectStatus';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSelectedAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import { getBotWalletNameBadges } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
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
import {
  accountSelectorWalletVisualV2,
  useAccountSelectorNativeListThemeV2,
} from '../accountSelectorNativeListV2';
import { useAddHiddenWallet } from '../WalletDetails/hooks/useAddHiddenWallet';

import { AccountSelectorCreateWalletButton } from './AccountSelectorCreateWalletButton';
import { buildGroupedAccountSelectorWallets } from './walletListUtils';

import type { IAccountSelectorWalletInfo } from '../../../type';

interface IWalletListProps {
  num: number;
  hideNonBackedUpWallet?: boolean;
}

export function AccountSelectorWalletListSideBarV2({
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

  const wallets = walletsResult?.wallets ?? emptyArray;

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

  const [settings, setSettings] = useSettingsPersistAtom();
  const intl = useIntl();
  const theme = useAccountSelectorNativeListThemeV2(true);
  const appTheme = useTheme();
  const {
    createHiddenWalletWithDialogConfirm,
    isLoading: isAddingHiddenWallet,
  } = useAddHiddenWallet();
  useEffect(() => {
    if (settings.showAddHiddenInWalletSidebar === undefined) {
      setSettings((prev) => ({ ...prev, showAddHiddenInWalletSidebar: true }));
    }
  }, [settings.showAddHiddenInWalletSidebar, setSettings]);

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

  const { md } = useMedia();
  const listRef = useRef<NativeListRef | null>(null);
  const containerRef = useRef<View>(null);
  const tooltipTokenRef = useRef<string | undefined>(undefined);
  const [walletTooltip, setWalletTooltip] = useState<{
    anchor: NativeListActionAnchor;
    left: number;
    top: number;
    title: string;
  }>();
  const closeWalletTooltip = useCallback(() => {
    const token = tooltipTokenRef.current;
    tooltipTokenRef.current = undefined;
    if (token) listRef.current?.setActionAnchorState({ token, open: false });
    setWalletTooltip(undefined);
  }, []);
  useEffect(() => {
    if (!md) closeWalletTooltip();
    const list = listRef.current;
    return () => {
      const token = tooltipTokenRef.current;
      if (token) list?.setActionAnchorState({ token, open: false });
    };
  }, [closeWalletTooltip, md]);

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

  const { snapshot, walletIds, walletNames, hiddenWalletActions } =
    useMemo(() => {
      const ids = new Set<string>();
      const names = new Map<string, string>();
      const hiddenActions = new Map<string, IDBWallet>();
      const toIdentity = (
        wallet: IAccountSelectorWalletInfo,
        badge?: string | number,
      ): IdentityRow => {
        ids.add(wallet.id);
        names.set(wallet.id, wallet.name);
        const badges = getBotWalletNameBadges({
          isBotWallet: accountUtils.isBotWallet({ walletId: wallet.id }),
          isBotWalletDeactivated:
            wallet.botStatus === BOT_WALLET_STATUS_DEACTIVATED,
        });
        return {
          type: 'identity',
          key: wallet.id,
          testID: `wallet-${wallet.id}`,
          presentation: 'walletSidebar',
          height: badges.length ? 90 : 68,
          title: wallet.name,
          titleActionKey:
            md && !platformEnv.isNative ? 'wallet.tooltip.name' : undefined,
          titleActionOnHover: md && !platformEnv.isNative,
          leading: accountSelectorWalletVisualV2({
            wallet,
            connected: walletConnectionMap.get(wallet.id),
            badge: badge ?? wallet.badge,
            badgeBackground: appTheme.bgApp.val,
            connectionColor: appTheme.bgSuccessStrong.val,
            theme,
          }),
          selected: selectedAccount.focusedWallet === wallet.id,
          opacity: wallet.deprecated ? 0.5 : 1,
          badges: badges.map((item) => ({
            key: item.key,
            text: item.label,
            tone: item.tone === 'caution' ? 'warning' : 'neutral',
          })),
          draggable: true,
          accessibilityLabel: [
            wallet.name,
            ...badges.map((item) => item.label),
          ].join(', '),
        };
      };
      const getChildWallets = (wallet: IAccountSelectorWalletInfo) => {
        if (accountUtils.isHwOrQrWallet({ walletId: wallet.id }))
          return wallet.hiddenWallets ?? [];
        if (wallet.isKeyless) return wallet.botWallets ?? [];
        return [];
      };
      const rows: RowModel[] = wallets.map((wallet) => {
        const parent = toIdentity(wallet);
        const childWallets = getChildWallets(wallet);
        const hasGroup =
          !accountUtils.isHwHiddenWallet({ wallet }) &&
          (childWallets.length > 0 ||
            shouldShowCreateHiddenWalletButtonFn({ wallet }));
        if (!hasGroup) return parent;
        const children = (childWallets ?? []).map((child, index) =>
          toIdentity(
            child,
            md && accountUtils.isHwOrQrWallet({ walletId: wallet.id })
              ? index + 1
              : undefined,
          ),
        );
        if (shouldShowCreateHiddenWalletButtonFn({ wallet })) {
          const key = `add-hidden:${wallet.id}`;
          hiddenActions.set(key, wallet);
          const title = intl.formatMessage({
            id: ETranslations.global_hidden_wallet,
          });
          names.set(key, title);
          children.push({
            type: 'identity',
            key,
            presentation: 'walletSidebar',
            height: 68,
            title,
            titleActionKey:
              md && !platformEnv.isNative ? 'wallet.tooltip.name' : undefined,
            titleActionOnHover: md && !platformEnv.isNative,
            leading: {
              kind: 'wallet',
              backgroundColor: '#00000000',
              shape: 'circle',
              borderStyle: 'dashed',
              borderColor: theme.separator,
              fallbackIcon: {
                name: 'PlusSmallOutline',
                tintColor: theme.iconSubdued,
              },
            },
            draggable: false,
          });
        }
        return {
          type: 'walletGroup',
          key: wallet.id,
          parent,
          children,
          draggable: true,
        };
      });
      return {
        walletIds: ids,
        walletNames: names,
        hiddenWalletActions: hiddenActions,
        snapshot: {
          schemaVersion: 1,
          generation: 1,
          theme,
          layout: {
            kind: 'linear',
            contentPaddingHorizontal: 8,
            contentPaddingTop: 8,
            contentPaddingBottom: 8,
            itemSpacing: 12,
          },
          rows,
          // cspell:ignore reorderable
          capabilities: { reorderable: true },
        } satisfies NativeListSnapshot,
      };
    }, [
      appTheme,
      intl,
      md,
      selectedAccount.focusedWallet,
      shouldShowCreateHiddenWalletButtonFn,
      theme,
      walletConnectionMap,
      wallets,
    ]);

  if (shouldHideWalletList) {
    return null;
  }

  return (
    <Stack
      ref={containerRef}
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
      <NativeList
        ref={listRef}
        style={{ flex: 1 }}
        testID="account-selector-wallet-list-v2"
        snapshot={snapshot}
        onActionAnchorInvalidated={(event) => {
          if (event.token === tooltipTokenRef.current) closeWalletTooltip();
        }}
        onRowAction={(event) => {
          if (event.actionKey === 'wallet.tooltip.name' && event.anchor) {
            const title = walletNames.get(event.rowKey ?? '');
            if (!title || platformEnv.isNative || !md) return;
            closeWalletTooltip();
            const { anchor } = event;
            tooltipTokenRef.current = anchor.token;
            listRef.current?.setActionAnchorState({
              token: anchor.token,
              open: true,
            });
            containerRef.current?.measureInWindow((x, y) => {
              if (tooltipTokenRef.current !== anchor.token) return;
              setWalletTooltip({
                anchor,
                left: anchor.windowRect.x - x,
                top: anchor.windowRect.y - y,
                title,
              });
            });
            return;
          }
          if (!event.rowKey || event.actionKey !== 'press') return;
          closeWalletTooltip();
          const walletToAdd = hiddenWalletActions.get(event.rowKey);
          if (walletToAdd) {
            if (!isAddingHiddenWallet)
              void createHiddenWalletWithDialogConfirm({ wallet: walletToAdd });
            return;
          }
          if (walletIds.has(event.rowKey)) onWalletPress(event.rowKey);
        }}
        onReorder={async (event) => {
          if (!walletsResult) return;
          const fromIndex = wallets.findIndex(
            (wallet) => wallet.id === event.key,
          );
          if (fromIndex < 0) return;
          const reordered = [...wallets];
          const [moved] = reordered.splice(fromIndex, 1);
          const toIndex = Math.max(
            0,
            Math.min(event.toIndex, reordered.length),
          );
          reordered.splice(toIndex, 0, moved);
          setResult({ wallets: reordered });
          await serviceAccount.insertWalletOrder({
            targetWalletId: moved.id,
            startWalletId: reordered[toIndex - 1]?.id,
            endWalletId: reordered[toIndex + 1]?.id,
            emitEvent: true,
          });
        }}
      />
      {walletTooltip ? (
        <Stack
          position="absolute"
          left={walletTooltip.left}
          top={walletTooltip.top}
          width={walletTooltip.anchor.windowRect.width}
          height={walletTooltip.anchor.windowRect.height}
          pointerEvents="none"
        >
          <Tooltip
            open
            placement="right"
            triggerAsChild
            onOpenChange={(open) => {
              if (!open) closeWalletTooltip();
            }}
            renderContent={walletTooltip.title}
            renderTrigger={
              <Stack
                width={walletTooltip.anchor.windowRect.width}
                height={walletTooltip.anchor.windowRect.height}
                pointerEvents="none"
              />
            }
          />
        </Stack>
      ) : null}
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

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  ESwitchSize,
  Page,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  Switch,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { showPrivacyChainSlotsFullDialog } from '@onekeyhq/kit/src/utils/privacyChainSlotsFullDialog';
import {
  PRIVACY_CHAIN_SYNC_STATUS_LABELS,
  formatPrivacyChainSyncDetail,
  formatPrivacyChainSyncError,
  getPrivacyChainNetworkSyncDisplay,
} from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import {
  BirthdayDialogForm,
  type IBirthdayFormState,
  type IEarliestBirthday,
  getBirthdayInputError,
  readEnableBirthday,
} from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls';
import {
  PrivacyEnableContent,
  createPrivacyEnableForm,
} from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/PrivacyEnableContent';
import {
  useDevSettingsPersistAtom,
  usePrivacyChainAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isLocalWalletSlotsFullError } from '@onekeyhq/kit-bg/src/vaults/localWallet/userFacingError';
import { IMPL_ZCASH } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes/setting';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes/setting';
import { formatDate, formatMonth } from '@onekeyhq/shared/src/utils/dateUtils';

import { PrivacyAccountRow } from './PrivacyAccountRow';

import type { RouteProp } from '@react-navigation/core';
import type { IntlShape } from 'react-intl';

const ZcashDebugSettings = LazyLoadPage(
  async () => {
    const { ZcashDebugSettings: Component } =
      await import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ZcashWasmGallery');
    return { default: Component };
  },
  undefined,
  true,
);

function SectionTitle({ children }: { children: string }) {
  return (
    <SizableText
      px="$5"
      pt="$5"
      pb="$2"
      size="$bodySm"
      color="$textSubdued"
      letterSpacing={0.6}
      textTransform="uppercase"
    >
      {children}
    </SizableText>
  );
}

async function getEarliestBirthday(
  networkId: string,
): Promise<IEarliestBirthday | undefined> {
  return (await getAccountSetup(networkId))?.earliestBirthday;
}

async function getAccountSetup(networkId: string) {
  const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
    networkId,
  });
  return settings.localWallet?.accountSetup;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

// Per-account attribution is impossible by design: the block cache and
// commitment trees are scanned once and serve every viewing key, so deleting
// one account frees almost nothing.
function PrivacyChainStorageSection({
  networkId,
  storageBytes,
  onChanged,
}: {
  networkId: string;
  storageBytes: number | null | undefined;
  onChanged: () => void;
}) {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);

  const handleReset = useCallback(() => {
    Dialog.confirm({
      title: intl.formatMessage({
        id: ETranslations.privacy_sync_resync__action,
      }),
      description: intl.formatMessage({
        id: ETranslations.privacy_sync_resync__desc,
      }),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_reset }),
      onConfirm: async () => {
        setBusy(true);
        try {
          await backgroundApiProxy.servicePrivacyChain.clearTransactionHistoryCache(
            { networkId },
          );
          onChanged();
        } finally {
          setBusy(false);
        }
      },
    });
  }, [intl, networkId, onChanged]);

  if (storageBytes === undefined) {
    return null;
  }
  return (
    <>
      <SectionTitle>
        {intl.formatMessage({
          id: ETranslations.privacy_sync_storage__title,
        })}
      </SectionTitle>
      <ListItem
        testID="privacy-sync-storage"
        icon="FolderOutline"
        title={intl.formatMessage({
          id: ETranslations.privacy_sync_local_data__title,
        })}
      >
        <XStack gap="$3" alignItems="center">
          <SizableText size="$bodyMdMedium">
            {storageBytes === null ? '\u2014' : formatBytes(storageBytes)}
          </SizableText>
          <Button
            testID="privacy-sync-storage-reset-btn"
            size="small"
            variant="secondary"
            disabled={busy || storageBytes === 0}
            onPress={handleReset}
          >
            {intl.formatMessage({ id: ETranslations.global_reset })}
          </Button>
        </XStack>
      </ListItem>
    </>
  );
}

// Per-account settings stay one level down -- several accounts share one
// scan, so a birthday shown here would have no owner.
function PrivacyChainNetworkSections({
  networkId,
  endpointUrl,
  endpointDefaultUrl,
  endpointIsCustom,
  endpointHealth,
  onChanged,
}: {
  networkId: string;
  endpointUrl: string | undefined;
  endpointDefaultUrl: string | undefined;
  endpointIsCustom: boolean;
  endpointHealth:
    | { ok: boolean; latencyMs: number | null; atMs: number }
    | undefined;
  onChanged: () => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [busy, setBusy] = useState(false);
  const showMobileDataRow = platformEnv.isNative;
  const showNodeRow = Boolean(endpointUrl && endpointDefaultUrl);
  let endpointStatus = '';
  if (endpointHealth && !endpointHealth.ok) {
    endpointStatus = intl.formatMessage({
      id: ETranslations.provider_unavailable,
    });
  } else if (endpointHealth && endpointHealth.latencyMs !== null) {
    endpointStatus = `${endpointHealth.latencyMs} ms`;
  }

  // Published, so a Use mobile data pressed on the light or token page shows here at once.
  const [{ allowCellularSync: allowCellular }] = usePrivacyChainAtom();
  useEffect(() => {
    void backgroundApiProxy.servicePrivacyChain.isPrivacySyncOnCellularAllowed();
  }, []);
  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
        onChanged();
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  return (
    <>
      {showMobileDataRow || showNodeRow ? (
        <SectionTitle>
          {intl.formatMessage({
            id: ETranslations.global_network,
          })}
        </SectionTitle>
      ) : null}
      {showMobileDataRow ? (
        <ListItem
          testID="privacy-sync-mobile-data"
          icon="SignalOutline"
          title={intl.formatMessage({
            id: ETranslations.privacy_sync_mobile_data__title,
          })}
          subtitle={intl.formatMessage({
            id: ETranslations.privacy_sync_mobile_data__desc,
          })}
        >
          <Switch
            testID="privacy-sync-allow-cellular-switch"
            size={ESwitchSize.small}
            value={allowCellular === true}
            disabled={busy || allowCellular === undefined}
            onChange={(next) =>
              void run(async () => {
                await backgroundApiProxy.servicePrivacyChain.setAllowCellularSync(
                  { allow: next },
                );
              })
            }
          />
        </ListItem>
      ) : null}
      {endpointUrl && endpointDefaultUrl ? (
        <ListItem
          testID="privacy-sync-node"
          icon="GlobusOutline"
          title={intl.formatMessage({
            id: ETranslations.privacy_sync_node__title,
          })}
          subtitle={[
            intl.formatMessage({
              id: endpointIsCustom
                ? ETranslations.content__custom
                : ETranslations.global_default,
            }),
            endpointUrl.replace(/^https?:\/\//, ''),
            endpointStatus,
          ]
            .filter(Boolean)
            .join(' · ')}
          drillIn
          // pushModal, not push: this page is mounted in two different modal
          // stacks, and a bare push of a Setting route throws in the other.
          onPress={() =>
            navigation.pushModal(EModalRoutes.SettingModal, {
              screen: EModalSettingRoutes.SettingCustomRPC,
              params: { networkId },
            })
          }
        />
      ) : null}
    </>
  );
}

type IPrivacyAccountEntry = {
  accountId: string;
  accountName: string;
  walletName: string;
  networkId: string;
  enabled: boolean;
  paused: boolean;
  // An enable still waiting on its password or device: neither on nor off yet.
  enabling: boolean;
  privacyDisabled?: boolean;
  birthdayTimestamp?: number;
  birthdayHintTimestamp?: number;
  birthdayHeight?: number;
  // Never scannable: privacy cannot be enabled for a temporary wallet.
  walletIsTemp: boolean;
  deriveLabel?: string;
};

type IPrivacyAccountOperation =
  | 'enable'
  | 'pause'
  | 'resume'
  | 'delete'
  | 'repair';

function getPrivacyAccountKey(entry: IPrivacyAccountEntry) {
  return `${entry.networkId}:${entry.accountId}`;
}

// One group per derive type, in list order.
function groupByDeriveLabel(entries: IPrivacyAccountEntry[]) {
  const groups = new Map<string, IPrivacyAccountEntry[]>();
  entries.forEach((entry) => {
    const label = entry.deriveLabel ?? '';
    groups.set(label, [...(groups.get(label) ?? []), entry]);
  });
  return Array.from(groups, ([label, items]) => ({ label, items }));
}

function formatShownBirthday(
  entry: Pick<
    IPrivacyAccountEntry,
    'birthdayTimestamp' | 'birthdayHintTimestamp' | 'birthdayHeight'
  >,
  intl: IntlShape,
): string | undefined {
  if (entry.birthdayTimestamp !== undefined) {
    return formatDate(new Date(entry.birthdayTimestamp), {
      hideTimeForever: true,
    });
  }
  if (entry.birthdayHeight !== undefined) {
    return intl.formatMessage(
      {
        id: ETranslations.privacy_sync_start_block__title,
      },
      { height: intl.formatNumber(entry.birthdayHeight) },
    );
  }
  return entry.birthdayHintTimestamp === undefined
    ? undefined
    : formatMonth(new Date(entry.birthdayHintTimestamp));
}

function PrivacyChainSettingsProgress({
  networkId,
  entries,
}: {
  networkId: string;
  entries: IPrivacyAccountEntry[];
}) {
  const intl = useIntl();
  const [state] = usePrivacyChainAtom();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const { result: localWalletSettings } = usePromiseResult(
    async () =>
      (await backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }))
        .localWallet,
    [networkId],
  );
  const accounts = entries.filter(
    (entry) =>
      entry.networkId === networkId &&
      !entry.walletIsTemp &&
      (entry.enabled || entry.paused),
  );
  const {
    status,
    progress: entry,
    labelId,
    syncError,
  } = getPrivacyChainNetworkSyncDisplay({
    state,
    networkId,
    syncedBelowBlocks: localWalletSettings?.syncedBelowBlocks ?? 1,
    blockTime: localWalletSettings,
    // Only accounts that scan: a server-disabled one never gets a position.
    accountIds: accounts
      .filter((account) => account.enabled && !account.privacyDisabled)
      .map((account) => account.accountId),
    accountPaused:
      accounts.length > 0 && accounts.every((account) => account.paused),
    unavailable:
      accounts.length > 0 &&
      accounts.every((account) => account.privacyDisabled),
  });
  const canResume = status === 'chainPaused';
  const canPause =
    (state.boostingNetworkIds.includes(networkId) ||
      state.dataBlockedNetworkIds.includes(networkId)) &&
    [
      'preparing',
      'syncing',
      'waitingWifi',
      'error',
      'storageUnsupported',
    ].includes(status);
  const toggleChainPause = useCallback(async () => {
    if (busyRef.current || (!canResume && !canPause)) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (canResume) {
        await backgroundApiProxy.servicePrivacyChain.startForegroundBoost({
          networkId,
          trigger: 'manual-sync',
        });
      } else {
        await backgroundApiProxy.servicePrivacyChain.pauseLocalWalletScan({
          networkId,
        });
      }
    } catch {
      defaultLogger.app.error.log('Privacy chain sync control failed');
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_an_error_occurred,
        }),
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [canPause, canResume, intl, networkId]);
  if (!accounts.length) return null;
  const error =
    status === 'storageUnsupported'
      ? intl.formatMessage({
          id: ETranslations.privacy_error_webview_outdated__msg,
        })
      : formatPrivacyChainSyncError(syncError, intl);
  const detail =
    error ??
    formatPrivacyChainSyncDetail({
      progress: entry,
      settings: localWalletSettings,
      stopped: ['accountPaused', 'chainPaused', 'waitingWifi'].includes(status),
      intl,
    }) ??
    undefined;
  return (
    <>
      <SectionTitle>
        {intl.formatMessage({ id: ETranslations.global_status })}
      </SectionTitle>
      <ListItem
        testID="privacy-sync-progress"
        icon="RefreshCcwOutline"
        title={intl.formatMessage({ id: labelId })}
        subtitle={
          <SizableText
            testID="privacy-sync-progress-detail"
            size="$bodyMd"
            color={error ? '$textCaution' : '$textSubdued'}
            minHeight="$10"
          >
            {detail}
          </SizableText>
        }
      >
        {canResume || canPause ? (
          <Button
            testID={
              canResume ? 'privacy-sync-resume-btn' : 'privacy-sync-pause-btn'
            }
            size="small"
            variant="secondary"
            loading={busy}
            disabled={busy}
            onPress={() => void toggleChainPause()}
          >
            {intl.formatMessage({
              id: canResume
                ? ETranslations.global_resume
                : ETranslations.global_pause,
            })}
          </Button>
        ) : null}
      </ListItem>
    </>
  );
}

// Everything goes through servicePrivacyChain; nothing here knows which chain it is.
export default function PrivacyNetworkSettings({
  walletId: walletIdProp,
  networkId: networkIdProp,
}: {
  walletId?: string;
  networkId?: string;
}) {
  const route =
    useRoute<
      RouteProp<
        IModalSettingParamList,
        EModalSettingRoutes.SettingPrivacyNetwork
      >
    >();
  const walletId = walletIdProp ?? route.params?.walletId;
  const networkIdFilter = networkIdProp ?? route.params?.networkId;
  const enableAccountId = route.params?.accountId;
  const enableSync = route.params?.enableSync;
  const navigation = useAppNavigation();
  const intl = useIntl();
  const isFocused = useRouteIsFocused();
  const [devSettings] = useDevSettingsPersistAtom();
  const [{ storageUnsupportedNetworkIds }] = usePrivacyChainAtom();
  const pendingAccountOperationsRef = useRef(new Map<string, Promise<void>>());
  const [busyAccountOperations, setBusyAccountOperations] = useState(
    new Map<string, IPrivacyAccountOperation>(),
  );
  const handledEnableRequestRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(true);
  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runAccountOperation = useCallback(
    (
      entry: IPrivacyAccountEntry,
      operation: IPrivacyAccountOperation,
      run: () => Promise<void>,
    ) => {
      const key = getPrivacyAccountKey(entry);
      const existing = pendingAccountOperationsRef.current.get(key);
      if (existing) return existing;
      // Register before running so repeated confirmations await the same outcome.
      const pending = Promise.resolve()
        .then(run)
        .finally(() => {
          pendingAccountOperationsRef.current.delete(key);
          if (mountedRef.current) {
            setBusyAccountOperations((current) => {
              const next = new Map(current);
              next.delete(key);
              return next;
            });
          }
        });
      pendingAccountOperationsRef.current.set(key, pending);
      setBusyAccountOperations((current) =>
        new Map(current).set(key, operation),
      );
      return pending;
    },
    [],
  );

  const { result: filteredNetwork } = usePromiseResult(async () => {
    if (!networkIdFilter) return undefined;
    const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
      networkId: networkIdFilter,
    });
    return network;
  }, [networkIdFilter]);

  const { result: accountListResult, run: refreshEntries } =
    usePromiseResult(async () => {
      if (!isFocused) return undefined;
      const accounts =
        await backgroundApiProxy.servicePrivacyChain.listLocalWalletAccounts({
          walletId,
        });
      const entries: IPrivacyAccountEntry[] = await Promise.all(
        accounts
          .filter(
            (account) =>
              !networkIdFilter || account.networkId === networkIdFilter,
          )
          .map(async (account) => {
            const state =
              await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountState(
                {
                  networkId: account.networkId,
                  accountId: account.accountId,
                },
              );
            return {
              accountId: account.accountId,
              accountName: account.accountName,
              walletName: account.walletName,
              networkId: account.networkId,
              enabled: state.enabled,
              paused: state.paused,
              enabling: state.pendingOperation === 'enable',
              privacyDisabled: state.privacyDisabled,
              birthdayTimestamp: state.birthdayTimestamp,
              birthdayHintTimestamp: state.birthdayHintTimestamp,
              birthdayHeight: state.birthdayHeight,
              walletIsTemp: account.walletIsTemp,
              deriveLabel: account.deriveLabel,
            };
          }),
      );
      return { walletId, networkIdFilter, entries };
    }, [isFocused, walletId, networkIdFilter]);
  const entries =
    accountListResult?.walletId === walletId &&
    accountListResult?.networkIdFilter === networkIdFilter
      ? accountListResult?.entries
      : undefined;

  useEffect(() => {
    if (!isFocused) return;
    const refresh = ({ networkId }: { networkId: string }) => {
      if (!networkIdFilter || networkId === networkIdFilter) {
        void refreshEntries();
      }
    };
    appEventBus.on(EAppEventBusNames.LocalWalletAccountsChanged, refresh);
    const refreshNetworks = () => void refreshEntries();
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, refreshNetworks);
    return () => {
      appEventBus.off(EAppEventBusNames.LocalWalletAccountsChanged, refresh);
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, refreshNetworks);
    };
  }, [isFocused, networkIdFilter, refreshEntries]);

  // The route may not name a network (the per-wallet entry lists every
  // chain); the network-wide sections below then stay hidden.
  const soleNetworkId =
    networkIdFilter ??
    (entries &&
    entries.length > 0 &&
    entries.every((e) => e.networkId === entries[0].networkId)
      ? entries[0].networkId
      : undefined);
  // Only one chain is listed, so a derive-type header cannot be mistaken for a chain.
  const deriveGroups =
    soleNetworkId && entries ? groupByDeriveLabel(entries) : [];
  const showDeriveGroups = deriveGroups.some((group) => group.label);

  const { result: networkInfoResult, run: refreshNetworkInfo } =
    usePromiseResult(
      async () => {
        if (!soleNetworkId) return undefined;
        const info = await backgroundApiProxy.servicePrivacyChain
          .getLocalWalletNetworkInfo({ networkId: soleNetworkId })
          .catch(() => undefined);
        return { networkId: soleNetworkId, info };
      },
      [soleNetworkId],
      { revalidateOnFocus: true },
    );
  const lastSuccessfulNetworkInfoRef =
    useRef<typeof networkInfoResult>(undefined);
  useEffect(() => {
    if (
      networkInfoResult?.networkId === soleNetworkId &&
      networkInfoResult?.info !== undefined
    ) {
      lastSuccessfulNetworkInfoRef.current = networkInfoResult;
    } else if (
      lastSuccessfulNetworkInfoRef.current?.networkId !== soleNetworkId
    ) {
      lastSuccessfulNetworkInfoRef.current = undefined;
    }
  }, [networkInfoResult, soleNetworkId]);
  // A failed refresh settles loading without removing previously loaded sections.
  const lastSuccessfulNetworkInfo =
    lastSuccessfulNetworkInfoRef.current?.networkId === soleNetworkId
      ? lastSuccessfulNetworkInfoRef.current?.info
      : undefined;
  const networkInfo =
    networkInfoResult?.networkId === soleNetworkId
      ? (networkInfoResult?.info ?? lastSuccessfulNetworkInfo)
      : undefined;
  // Commit the first list with its preceding network rows, not before they arrive.
  const initialSectionsReady =
    !soleNetworkId || networkInfoResult?.networkId === soleNetworkId;

  const askBirthdayAndEnable = useCallback(
    async (
      entry: IPrivacyAccountEntry,
      options?: { onCancel?: () => void; isActive?: () => boolean },
    ) =>
      runAccountOperation(entry, 'enable', async () => {
        // A full network refuses before the birthday form asks for anything.
        try {
          await backgroundApiProxy.servicePrivacyChain.assertLocalWalletAccountAdmission(
            { networkId: entry.networkId, accountId: entry.accountId },
          );
        } catch (error) {
          if (!isLocalWalletSlotsFullError(error)) throw error;
          if (options?.isActive && !options.isActive()) return;
          showPrivacyChainSlotsFullDialog({ intl, networkId: entry.networkId });
          return;
        }
        if (options?.isActive && !options.isActive()) return;
        const enableWith = async (birthday: {
          birthdayHeight?: number;
          birthdayTimestamp?: number;
        }) => {
          try {
            await backgroundApiProxy.servicePrivacyChain.enableLocalWalletAccount(
              {
                networkId: entry.networkId,
                accountId: entry.accountId,
                ...birthday,
              },
            );
            await refreshEntries();
          } catch (error) {
            // Other failures keep this dialog open; the limit gets its own.
            if (!isLocalWalletSlotsFullError(error)) throw error;
            showPrivacyChainSlotsFullDialog({
              intl,
              networkId: entry.networkId,
            });
          }
        };
        const twinBirthday =
          await backgroundApiProxy.servicePrivacyChain.getLocalWalletTwinBirthday(
            { networkId: entry.networkId, accountId: entry.accountId },
          );
        if (options?.isActive && !options.isActive()) return;
        if (twinBirthday) {
          await enableWith(twinBirthday);
          return;
        }
        // Read once on enabling, not for every listed account.
        const accountSetup = await getAccountSetup(entry.networkId);
        const earliestBirthday = accountSetup?.earliestBirthday;
        if (options?.isActive && !options.isActive()) return;
        const formRef = createPrivacyEnableForm({ earliestBirthday });
        Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.privacy_enable_account__title,
          }),
          showConfirmButton: true,
          showCancelButton: true,
          description: entry.accountName,
          renderContent: (
            <PrivacyEnableContent
              accountId={entry.accountId}
              deviceExportsViewKey={accountSetup?.deviceExportsViewKey}
              networkId={entry.networkId}
              formRef={formRef}
              earliestBirthday={earliestBirthday}
              birthdayHintTimestamp={entry.birthdayHintTimestamp}
            />
          ),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_enable,
          }),
          onClose: (extra) => {
            if (extra?.flag !== 'confirm') options?.onCancel?.();
          },
          onConfirm: async ({ preventClose }) => {
            const birthday = readEnableBirthday(
              formRef.current,
              earliestBirthday,
              entry.networkId,
            );
            if (!birthday) {
              Toast.error({
                title: intl.formatMessage({
                  id: getBirthdayInputError(formRef.current.mode),
                }),
              });
              preventClose();
              return;
            }
            await runAccountOperation(entry, 'enable', () =>
              enableWith(birthday),
            );
          },
        });
      }),
    [intl, refreshEntries, runAccountOperation],
  );

  const enableAccount = askBirthdayAndEnable;

  const toggleAccountPause = useCallback(
    async (entry: IPrivacyAccountEntry) =>
      runAccountOperation(
        entry,
        entry.paused ? 'resume' : 'pause',
        async () => {
          try {
            const params = {
              networkId: entry.networkId,
              accountId: entry.accountId,
            };
            if (entry.paused) {
              await backgroundApiProxy.servicePrivacyChain.enableLocalWalletAccount(
                params,
              );
            } else {
              await backgroundApiProxy.servicePrivacyChain.disableLocalWalletAccount(
                params,
              );
            }
            await refreshEntries();
          } catch (error) {
            console.error('[privacyChain] account sync control failed', error);
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_an_error_occurred,
              }),
            });
          }
        },
      ),
    [intl, refreshEntries, runAccountOperation],
  );

  useEffect(() => {
    if (
      !isFocused ||
      !enableSync ||
      !enableAccountId ||
      !networkIdFilter ||
      !entries
    ) {
      return;
    }
    const requestKey = `${networkIdFilter}:${enableAccountId}`;
    if (handledEnableRequestRef.current === requestKey) return;
    // Refreshes and dialog focus changes must not reopen the requested flow.
    handledEnableRequestRef.current = requestKey;
    const entry = entries.find(
      (account) =>
        account.accountId === enableAccountId &&
        account.networkId === networkIdFilter,
    );
    if (!entry || entry.walletIsTemp || entry.privacyDisabled) {
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.global_not_available }),
      });
      return;
    }
    if (entry.enabling || (entry.enabled && !entry.paused)) return;

    void (async () => {
      try {
        if (entry.paused) {
          // Resume uses the saved birthday; do not ask for a new scan start.
          await toggleAccountPause(entry);
        } else {
          await askBirthdayAndEnable(entry, {
            isActive: () =>
              mountedRef.current &&
              focusedRef.current &&
              handledEnableRequestRef.current === requestKey,
            onCancel: () => {
              if (mountedRef.current) navigation.popStack();
            },
          });
        }
      } catch (error) {
        console.error('[privacyChain] receive enable flow failed', error);
        if (mountedRef.current) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            }),
          });
        }
      }
    })();
  }, [
    askBirthdayAndEnable,
    enableAccountId,
    enableSync,
    entries,
    intl,
    isFocused,
    navigation,
    networkIdFilter,
    toggleAccountPause,
  ]);

  const editBirthday = useCallback(
    async (entry: IPrivacyAccountEntry) => {
      const earliestBirthday = await getEarliestBirthday(entry.networkId);
      const formRef: { current: IBirthdayFormState } = {
        current: {
          mode: 'saved-birthday',
          date:
            entry.birthdayTimestamp === undefined
              ? null
              : new Date(entry.birthdayTimestamp),
          height: entry.birthdayHeight?.toString(),
        },
      };
      Dialog.confirm({
        title: intl.formatMessage({
          id: ETranslations.privacy_sync_start__title,
        }),
        tone: 'warning',
        boundedSheetLayout: true,
        fixedHeaderFooterHeight: 600,
        sheetDragArea: 'header',
        renderContent: (
          <YStack gap="$4">
            <SizableText size="$bodyLg">
              {intl.formatMessage({
                id: ETranslations.privacy_sync_resync__desc,
              })}
            </SizableText>
            <BirthdayDialogForm
              networkId={entry.networkId}
              formRef={formRef}
              currentBirthdayHeight={entry.birthdayHeight}
              earliestBirthday={earliestBirthday}
            />
          </YStack>
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslations.privacy_sync_resync__action,
        }),
        onConfirm: async ({ preventClose }) => {
          const { fromEarliest } = formRef.current;
          let mode = formRef.current.mode;
          let birthdayTimestamp: number | undefined;
          let birthdayHeight: number | undefined;
          if (fromEarliest && earliestBirthday) {
            mode = 'height';
            birthdayHeight = earliestBirthday.height;
          } else if (mode === 'date' || mode === 'height') {
            const birthday = readEnableBirthday(
              formRef.current,
              earliestBirthday,
              entry.networkId,
            );
            if (!birthday) {
              Toast.error({
                title: intl.formatMessage({
                  id: getBirthdayInputError(mode),
                }),
              });
              preventClose();
              return;
            }
            birthdayTimestamp = birthday.birthdayTimestamp;
            birthdayHeight = birthday.birthdayHeight;
          }
          await runAccountOperation(entry, 'repair', async () => {
            await backgroundApiProxy.servicePrivacyChain.repairLocalChainData({
              networkId: entry.networkId,
              accountId: entry.accountId,
              mode: mode === 'date' ? 'month' : mode,
              birthdayTimestamp,
              birthdayHeight,
            });
            await refreshEntries();
          });
        },
      });
    },
    [intl, refreshEntries, runAccountOperation],
  );

  // Deleting also stops synchronization; authorization is required on a later enable.
  const deleteAccountData = useCallback(
    (entry: IPrivacyAccountEntry) => {
      Dialog.confirm({
        title: intl.formatMessage({
          id: ETranslations.privacy_delete_data__title,
        }),
        description: intl.formatMessage({
          id: ETranslations.privacy_delete_data__desc,
        }),
        tone: 'destructive',
        onConfirmText: intl.formatMessage({ id: ETranslations.global_delete }),
        onConfirm: async () =>
          runAccountOperation(entry, 'delete', async () => {
            await backgroundApiProxy.servicePrivacyChain.deleteLocalWalletAccountData(
              { networkId: entry.networkId, accountId: entry.accountId },
            );
            await refreshEntries();
          }),
      });
    },
    [intl, refreshEntries, runAccountOperation],
  );

  const renderAccount = (
    entry: IPrivacyAccountEntry,
    showDeriveLabel: boolean,
  ) => {
    const operation = busyAccountOperations.get(getPrivacyAccountKey(entry));
    const busy = operation !== undefined;
    const actionLoading =
      operation === 'enable' || operation === 'pause' || operation === 'resume';
    // Same order as the sync status: unavailable, enabling, paused, then the switch itself.
    let statusId: ETranslations = entry.enabled
      ? ETranslations.global_enabled
      : ETranslations.global_disabled;
    if (entry.walletIsTemp || entry.privacyDisabled) {
      statusId = ETranslations.global_not_available;
    } else if (entry.enabling) {
      statusId = PRIVACY_CHAIN_SYNC_STATUS_LABELS.enabling;
    } else if (entry.paused) {
      statusId = PRIVACY_CHAIN_SYNC_STATUS_LABELS.accountPaused;
    }
    const status = intl.formatMessage({ id: statusId });
    const canEnable = !entry.enabled && !entry.paused && !entry.enabling;
    return (
      <PrivacyAccountRow
        key={getPrivacyAccountKey(entry)}
        accountId={entry.accountId}
        accountName={entry.accountName}
        networkId={entry.networkId}
        subtitle={[
          entry.walletName,
          showDeriveLabel ? entry.deriveLabel : undefined,
          status,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <>
            {!entry.walletIsTemp && (entry.enabled || entry.paused) ? (
              <Button
                testID={`privacy-network-${entry.paused ? 'resume' : 'pause'}-${entry.accountId}`}
                size="small"
                variant="secondary"
                loading={actionLoading}
                disabled={busy || entry.privacyDisabled}
                onPress={() => void toggleAccountPause(entry)}
              >
                {intl.formatMessage({
                  id: entry.paused
                    ? ETranslations.global_resume
                    : ETranslations.global_pause,
                })}
              </Button>
            ) : null}
            {!entry.walletIsTemp && canEnable ? (
              <Button
                testID={`privacy-network-enable-${entry.accountId}`}
                size="small"
                variant="primary"
                loading={actionLoading}
                disabled={busy || entry.privacyDisabled}
                onPress={() => void enableAccount(entry)}
              >
                {intl.formatMessage({ id: ETranslations.global_enable })}
              </Button>
            ) : null}
          </>
        }
        showBirthday={entry.enabled || entry.paused}
        birthday={formatShownBirthday(entry, intl)}
        birthdayDisabled={busy || entry.paused}
        deleteDisabled={busy}
        onEditBirthday={() => void editBirthday(entry)}
        onDelete={() => deleteAccountData(entry)}
      >
        {entry.walletIsTemp ? (
          <SizableText
            testID={`privacy-network-temp-wallet-${entry.accountId}`}
            px="$3"
            pb="$3"
            size="$bodySm"
            color="$textSubdued"
          >
            {intl.formatMessage({
              id: ETranslations.privacy_temp_wallet_unavailable__desc,
            })}
          </SizableText>
        ) : null}
        {entry.enabled &&
        storageUnsupportedNetworkIds.includes(entry.networkId) ? (
          <SizableText
            testID={`privacy-network-storage-error-${entry.accountId}`}
            px="$3"
            pb="$3"
            size="$bodySm"
            color="$textCaution"
          >
            {intl.formatMessage({
              id: ETranslations.privacy_error_webview_outdated__msg,
            })}
          </SizableText>
        ) : null}
      </PrivacyAccountRow>
    );
  };

  return (
    <Page testID="settings-privacy-network-page">
      <Page.Header
        title={
          filteredNetwork?.name ??
          intl.formatMessage({ id: ETranslations.privacy_sync_menu__title })
        }
      />
      <Page.Body>
        {entries && initialSectionsReady ? (
          <ScrollView>
            {soleNetworkId ? (
              <PrivacyChainSettingsProgress
                networkId={soleNetworkId}
                entries={entries}
              />
            ) : null}
            {soleNetworkId ? (
              <PrivacyChainNetworkSections
                networkId={soleNetworkId}
                endpointUrl={networkInfo?.endpointUrl}
                endpointDefaultUrl={networkInfo?.endpointDefaultUrl}
                endpointIsCustom={networkInfo?.endpointIsCustom ?? false}
                endpointHealth={networkInfo?.endpointHealth}
                onChanged={() => {
                  void refreshNetworkInfo();
                  void refreshEntries();
                }}
              />
            ) : null}
            <SectionTitle>
              {intl.formatMessage({
                id: ETranslations.global_accounts,
              })}
            </SectionTitle>
            {entries.length === 0 ? (
              <Stack px="$5" py="$4" testID="settings-privacy-network-empty">
                <SizableText color="$textSubdued">
                  {intl.formatMessage({ id: ETranslations.no_account })}
                </SizableText>
              </Stack>
            ) : (
              <>
                {showDeriveGroups
                  ? deriveGroups.map(({ label, items }) => (
                      <YStack
                        key={label}
                        testID={`privacy-network-derive-group-${label}`}
                      >
                        {label ? (
                          <SizableText px="$5" pb="$2" size="$bodyMdMedium">
                            {label}
                          </SizableText>
                        ) : null}
                        {items.map((entry) => renderAccount(entry, false))}
                      </YStack>
                    ))
                  : entries.map((entry) => renderAccount(entry, true))}
              </>
            )}
            {devSettings.enabled && soleNetworkId ? (
              <PrivacyChainStorageSection
                networkId={soleNetworkId}
                storageBytes={networkInfo?.storageBytes}
                onChanged={() => {
                  void refreshNetworkInfo();
                  void refreshEntries();
                }}
              />
            ) : null}
            {devSettings.enabled && filteredNetwork?.impl === IMPL_ZCASH ? (
              <>
                <Divider my="$2" />
                <YStack px="$5" py="$4" testID="settings-privacy-network-debug">
                  <ZcashDebugSettings />
                </YStack>
              </>
            ) : null}
          </ScrollView>
        ) : (
          <Stack flex={1} alignItems="center" justifyContent="center">
            <Spinner />
          </Stack>
        )}
      </Page.Body>
    </Page>
  );
}

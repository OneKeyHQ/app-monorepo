import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

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
  formatPrivacyChainSyncDetail,
  formatPrivacyChainSyncError,
  getPrivacyChainNetworkSyncDisplay,
} from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import { AccountManagerTestIDs } from '@onekeyhq/kit/src/views/AccountManagerStacks/testIDs';
import {
  BirthdayDialogForm,
  type IBirthdayFormState,
  type IEarliestBirthday,
  PrivacyEnableDisclosure,
  createEnableBirthdayForm,
  getBirthdayInputError,
  readEnableBirthday,
} from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes/setting';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes/setting';
import { formatDate, formatMonth } from '@onekeyhq/shared/src/utils/dateUtils';

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
  const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
    networkId,
  });
  return settings.localWallet?.accountSetup.earliestBirthday;
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

  const { result: allowCellular, run: refreshAllowCellular } = usePromiseResult(
    async () =>
      backgroundApiProxy.servicePrivacyChain.getAllowPrivacySyncOnCellular(),
    [],
  );
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
                await refreshAllowCellular();
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
  birthdayTimestamp?: number;
  birthdayHintTimestamp?: number;
  birthdayHeight?: number;
  earliestBirthdayHeight?: number;
  // Never scannable: privacy cannot be enabled for a temporary wallet.
  walletIsTemp: boolean;
  deriveLabel?: string;
};

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
    | 'birthdayTimestamp'
    | 'birthdayHintTimestamp'
    | 'birthdayHeight'
    | 'earliestBirthdayHeight'
  >,
  intl: IntlShape,
): string | undefined {
  if (entry.birthdayTimestamp !== undefined) {
    return formatDate(new Date(entry.birthdayTimestamp), {
      hideTimeForever: true,
    });
  }
  if (entry.birthdayHeight !== undefined) {
    if (
      entry.earliestBirthdayHeight !== undefined &&
      entry.birthdayHeight <= entry.earliestBirthdayHeight
    ) {
      return intl.formatMessage({
        id: ETranslations.privacy_sync_start_earliest__title,
      });
    }
    return intl.formatMessage(
      {
        id: ETranslations.privacy_sync_start_block__title,
      },
      { height: entry.birthdayHeight },
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
    entry,
    labelId,
    isPaused,
    isHeldByData,
    isStorageUnsupported,
    syncError,
  } = getPrivacyChainNetworkSyncDisplay({
    state,
    networkId,
    accountPaused:
      accounts.length > 0 && accounts.every((account) => account.paused),
  });
  if (!accounts.length) return null;
  const error = isStorageUnsupported
    ? intl.formatMessage({
        id: ETranslations.privacy_error_webview_outdated__msg,
      })
    : formatPrivacyChainSyncError(syncError, intl);
  const detail =
    error ??
    formatPrivacyChainSyncDetail({
      progress: entry,
      settings: localWalletSettings,
      stopped: isPaused || isHeldByData,
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
        subtitle={detail}
        subtitleProps={error ? { color: '$textCaution' } : undefined}
      />
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
  const intl = useIntl();
  const isFocused = useRouteIsFocused();
  const [devSettings] = useDevSettingsPersistAtom();
  const [{ storageUnsupportedNetworkIds }] = usePrivacyChainAtom();
  const [busyAccountId, setBusyAccountId] = useState<string | undefined>();

  const { result: filteredNetwork } = usePromiseResult(async () => {
    if (!networkIdFilter) return undefined;
    const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
      networkId: networkIdFilter,
    });
    return network;
  }, [networkIdFilter]);

  const { result: entries, run: refreshEntries } =
    usePromiseResult(async (): Promise<IPrivacyAccountEntry[] | undefined> => {
      if (!isFocused) return undefined;
      const accounts =
        await backgroundApiProxy.servicePrivacyChain.listLocalWalletAccounts({
          walletId,
        });
      return Promise.all(
        accounts
          .filter(
            (account) =>
              !networkIdFilter || account.networkId === networkIdFilter,
          )
          .map(async (account) => {
            const [state, earliestBirthday] = await Promise.all([
              backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountState(
                {
                  networkId: account.networkId,
                  accountId: account.accountId,
                },
              ),
              getEarliestBirthday(account.networkId),
            ]);
            return {
              accountId: account.accountId,
              accountName: account.accountName,
              walletName: account.walletName,
              networkId: account.networkId,
              enabled: state.enabled,
              paused: state.paused,
              birthdayTimestamp: state.birthdayTimestamp,
              birthdayHintTimestamp: state.birthdayHintTimestamp,
              birthdayHeight: state.birthdayHeight,
              earliestBirthdayHeight: earliestBirthday?.height,
              walletIsTemp: account.walletIsTemp,
              deriveLabel: account.deriveLabel,
            };
          }),
      );
    }, [isFocused, walletId, networkIdFilter]);

  useEffect(() => {
    if (!isFocused) return;
    const refresh = ({ networkId }: { networkId: string }) => {
      if (!networkIdFilter || networkId === networkIdFilter) {
        void refreshEntries();
      }
    };
    appEventBus.on(EAppEventBusNames.LocalWalletAccountsChanged, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.LocalWalletAccountsChanged, refresh);
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

  const { result: networkInfo, run: refreshNetworkInfo } = usePromiseResult(
    async () => {
      if (!soleNetworkId) return undefined;
      return backgroundApiProxy.servicePrivacyChain.getLocalWalletNetworkInfo({
        networkId: soleNetworkId,
      });
    },
    [soleNetworkId],
    { revalidateOnFocus: true },
  );

  const askBirthdayAndEnable = useCallback(
    async (entry: IPrivacyAccountEntry) => {
      // A full network refuses before the birthday form asks for anything.
      try {
        await backgroundApiProxy.servicePrivacyChain.assertLocalWalletAccountAdmission(
          { networkId: entry.networkId, accountId: entry.accountId },
        );
      } catch (error) {
        if (!isLocalWalletSlotsFullError(error)) throw error;
        showPrivacyChainSlotsFullDialog({ intl });
        return;
      }
      const enableWith = async (birthday: {
        birthdayHeight?: number;
        birthdayTimestamp?: number;
      }) => {
        setBusyAccountId(entry.accountId);
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
          showPrivacyChainSlotsFullDialog({ intl });
        } finally {
          setBusyAccountId(undefined);
        }
      };
      const twinBirthday =
        await backgroundApiProxy.servicePrivacyChain.getLocalWalletTwinBirthday(
          { networkId: entry.networkId, accountId: entry.accountId },
        );
      if (twinBirthday) {
        await enableWith(twinBirthday);
        return;
      }
      const earliestBirthday = await getEarliestBirthday(entry.networkId);
      const formRef = createEnableBirthdayForm(entry.birthdayHintTimestamp);
      Dialog.confirm({
        title: entry.accountName,
        renderContent: (
          <YStack gap="$4">
            <PrivacyEnableDisclosure
              hasRecommendedMonth={
                typeof entry.birthdayHintTimestamp === 'number'
              }
            />
            <BirthdayDialogForm
              networkId={entry.networkId}
              formRef={formRef}
              allowSavedBirthday={false}
              earliestBirthday={earliestBirthday}
            />
          </YStack>
        ),
        onConfirmText: intl.formatMessage({ id: ETranslations.global_enable }),
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
          await enableWith(birthday);
        },
      });
    },
    [intl, refreshEntries],
  );

  const enableAccount = askBirthdayAndEnable;

  const toggleAccountPause = useCallback(
    async (entry: IPrivacyAccountEntry) => {
      setBusyAccountId(entry.accountId);
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
      } finally {
        setBusyAccountId(undefined);
      }
    },
    [refreshEntries],
  );

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
        description: intl.formatMessage({
          id: ETranslations.privacy_sync_resync__desc,
        }),
        tone: 'warning',
        renderContent: (
          <BirthdayDialogForm
            networkId={entry.networkId}
            formRef={formRef}
            currentBirthdayHeight={entry.birthdayHeight}
            earliestBirthday={earliestBirthday}
          />
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
          await backgroundApiProxy.servicePrivacyChain.repairLocalChainData({
            networkId: entry.networkId,
            accountId: entry.accountId,
            mode: mode === 'date' ? 'month' : mode,
            birthdayTimestamp,
            birthdayHeight,
          });
          await refreshEntries();
        },
      });
    },
    [intl, refreshEntries],
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
        onConfirm: async () => {
          setBusyAccountId(entry.accountId);
          try {
            await backgroundApiProxy.servicePrivacyChain.deleteLocalWalletAccountData(
              { networkId: entry.networkId, accountId: entry.accountId },
            );
            await refreshEntries();
          } finally {
            setBusyAccountId(undefined);
          }
        },
      });
    },
    [intl, refreshEntries],
  );

  const renderAccount = (
    entry: IPrivacyAccountEntry,
    showDeriveLabel: boolean,
  ) => {
    const busy = busyAccountId !== undefined;
    const statusId: ETranslations = entry.enabled
      ? ETranslations.global_enabled
      : ETranslations.global_disabled;
    let status = intl.formatMessage({
      id: entry.paused ? ETranslations.syncing_paused__title : statusId,
    });
    if (entry.walletIsTemp) {
      status = intl.formatMessage({ id: ETranslations.global_not_available });
    }
    return (
      <YStack
        key={entry.accountId}
        mx="$5"
        mb="$3"
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        overflow="hidden"
      >
        <ListItem
          mx="$0"
          testID={AccountManagerTestIDs.privacyNetworkAccount(entry.accountId)}
          icon="ShieldOutline"
          title={entry.accountName}
          subtitle={[
            entry.walletName,
            showDeriveLabel ? entry.deriveLabel : undefined,
            status,
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          {!entry.walletIsTemp && (entry.enabled || entry.paused) ? (
            <Button
              testID={`privacy-network-${entry.paused ? 'resume' : 'pause'}-${entry.accountId}`}
              size="small"
              variant="secondary"
              loading={busyAccountId === entry.accountId}
              disabled={busy}
              onPress={() => void toggleAccountPause(entry)}
            >
              {intl.formatMessage({
                id: entry.paused
                  ? ETranslations.global_resume
                  : ETranslations.global_pause,
              })}
            </Button>
          ) : null}
          {!entry.walletIsTemp && !entry.enabled && !entry.paused ? (
            <Button
              testID={`privacy-network-enable-${entry.accountId}`}
              size="small"
              variant="primary"
              loading={busyAccountId === entry.accountId}
              disabled={busy}
              onPress={() => void enableAccount(entry)}
            >
              {intl.formatMessage({ id: ETranslations.global_enable })}
            </Button>
          ) : null}
        </ListItem>
        <YStack testID={`privacy-network-account-detail-${entry.accountId}`}>
          <Divider mx="$4" />
          {entry.walletIsTemp ? (
            <SizableText
              testID={`privacy-network-temp-wallet-${entry.accountId}`}
              px="$5"
              py="$3"
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
              px="$5"
              py="$3"
              size="$bodySm"
              color="$textCaution"
            >
              {intl.formatMessage({
                id: ETranslations.privacy_error_webview_outdated__msg,
              })}
            </SizableText>
          ) : null}
          {entry.enabled || entry.paused ? (
            <ListItem
              mx="$0"
              testID={`privacy-network-birthday-${entry.accountId}`}
              icon="Calendar2Outline"
              title={intl.formatMessage({
                id: ETranslations.privacy_sync_start__title,
              })}
              subtitle={formatShownBirthday(entry, intl)}
              disabled={busy || entry.paused}
              drillIn
              onPress={() => void editBirthday(entry)}
            />
          ) : null}
          <ListItem
            mx="$0"
            testID={`privacy-network-delete-${entry.accountId}`}
            icon="DeleteOutline"
            title={intl.formatMessage({
              id: ETranslations.privacy_delete_data__title,
            })}
            subtitle={intl.formatMessage({
              id: ETranslations.privacy_delete_data__desc,
            })}
            titleProps={{ color: '$textCritical' }}
            disabled={busy}
            onPress={() => deleteAccountData(entry)}
          />
        </YStack>
      </YStack>
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
        {entries ? (
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

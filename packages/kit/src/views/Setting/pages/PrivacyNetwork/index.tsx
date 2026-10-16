import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Dialog,
  Divider,
  ESwitchSize,
  Page,
  Progress,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  Switch,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useUnresolvedBroadcastDialog } from '@onekeyhq/kit/src/hooks/useUnresolvedBroadcastDialog';
import {
  formatPrivacyChainRemainingBlocks,
  formatPrivacyChainSyncProgress,
  getPrivacyChainBackfillProgress,
  getPrivacyChainScanRegionLabelId,
  getPrivacyChainSyncLabel,
} from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import { AccountManagerTestIDs } from '@onekeyhq/kit/src/views/AccountManagerStacks/testIDs';
import {
  BirthdayDialogForm,
  type IBirthdayFormState,
  type IEarliestBirthday,
  PrivacyEnableDisclosure,
  createEnableBirthdayForm,
  readEnableBirthday,
} from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls';
import {
  useDevSettingsPersistAtom,
  usePrivacyChainAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ILocalWalletSlotUsage,
  ILocalWalletSyncProgress,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { IMPL_ZCASH } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes/setting';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes/setting';
import { formatMonth } from '@onekeyhq/shared/src/utils/dateUtils';
import { isUnresolvedPrivacyChainBroadcastError } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';

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

type ISlotOccupant = ILocalWalletSlotUsage['occupants'][number];

type ISlotSelection = { accountId?: string };

// The list comes from the background: slots are held across wallets this page cannot see.
function SlotReplaceForm({
  occupants,
  hiddenCount,
  selectionRef,
}: {
  occupants: ISlotOccupant[];
  hiddenCount: number;
  selectionRef: { current: ISlotSelection };
}) {
  const intl = useIntl();
  const [selected, setSelected] = useState<string | undefined>(
    occupants.length === 1 ? occupants[0].accountId : undefined,
  );
  useEffect(() => {
    selectionRef.current.accountId = selected;
  }, [selected, selectionRef]);
  return (
    <YStack>
      {occupants.map((occupant) => (
        <ListItem
          key={occupant.accountId}
          testID={`privacy-slot-occupant-${occupant.accountId}`}
          title={occupant.accountName}
          subtitle={[
            occupant.walletName,
            occupant.aliasCount > 1
              ? intl.formatMessage(
                  {
                    id: ETranslations.privacy_slots_shared_key__msg,
                  },
                  { count: occupant.aliasCount },
                )
              : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          checkMark={selected === occupant.accountId}
          onPress={() => setSelected(occupant.accountId)}
        />
      ))}
      {hiddenCount > 0 ? (
        <SizableText size="$bodySm" color="$textSubdued" px="$5" pt="$2">
          {intl.formatMessage(
            {
              id: ETranslations.privacy_slots_locked_wallets__msg,
            },
            { count: hiddenCount },
          )}
        </SizableText>
      ) : null}
      <SizableText size="$bodySm" color="$textCaution" px="$5" pt="$2">
        {intl.formatMessage({
          id: ETranslations.privacy_slots_replace__desc,
        })}
      </SizableText>
    </YStack>
  );
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
  enabledAccountCount,
  isPaused,
  isHeldByData,
  isStorageUnsupported,
  progress,
  endpointUrl,
  endpointDefaultUrl,
  endpointIsCustom,
  endpointHealth,
  onChanged,
}: {
  networkId: string;
  enabledAccountCount?: number;
  isPaused: boolean;
  isHeldByData: boolean;
  isStorageUnsupported: boolean;
  progress: Record<string, ILocalWalletSyncProgress>;
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
  // Cellular toggle only applies to native mobile runtimes.
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
  const { result: scanRegionHints } = usePromiseResult(async () => {
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId,
    });
    return settings.localWallet?.scanRegionHints;
  }, [networkId]);
  // Accounts share one scan queue, so the slowest one is the headline.
  const behind = getPrivacyChainBackfillProgress(progress, networkId);

  // Once backfill is done every account is at the same height; a chain
  // never "finishes", it only keeps up.
  const atTip = Object.entries(progress)
    .filter(([key]) => key.startsWith(`${networkId}:`))
    .map(([, value]) => value)
    .find(
      (value) =>
        typeof value.tipScannedHeight === 'number' &&
        typeof value.chainTip === 'number',
    );

  const heldByData = isHeldByData;
  const stateLabel = intl.formatMessage({
    id: getPrivacyChainSyncLabel({
      storageUnsupported: isStorageUnsupported,
      disabled: enabledAccountCount === 0,
      paused: isPaused,
      held: heldByData,
      preparing: enabledAccountCount === undefined || (!behind && !atTip),
      backfilling: Boolean(behind),
    }),
  });
  let stateIcon: IKeyOfIcons = 'RefreshCcwOutline';
  if (isStorageUnsupported) {
    stateIcon = 'ErrorOutline';
  } else if (enabledAccountCount === 0 || isPaused) {
    stateIcon = 'PauseOutline';
  } else if (heldByData) {
    stateIcon = 'SignalOutline';
  }
  const ratio = behind?.backfillProgress ?? null;
  const regionLabelId = getPrivacyChainScanRegionLabelId(
    scanRegionHints,
    behind?.backfillScannedHeight,
  );
  const detail = behind
    ? [
        formatPrivacyChainSyncProgress({
          scanned: behind.backfillScannedHeight,
          target: behind.backfillTargetHeight,
          progress: behind.backfillProgress,
        }),
        formatPrivacyChainRemainingBlocks(behind, intl),
        regionLabelId ? intl.formatMessage({ id: regionLabelId }) : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : formatPrivacyChainSyncProgress({
        scanned: atTip?.tipScannedHeight,
        target: atTip?.chainTip,
      });

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
      <SectionTitle>
        {intl.formatMessage({
          id: ETranslations.global_status,
        })}
      </SectionTitle>
      <ListItem
        testID="privacy-sync-status"
        icon={stateIcon}
        title={stateLabel}
        // Before figures arrive the row stays "— / —": unknown, not missing.
        subtitle={enabledAccountCount === 0 ? undefined : detail || '— / —'}
      >
        {!isStorageUnsupported &&
        enabledAccountCount !== undefined &&
        enabledAccountCount > 0 ? (
          <Button
            testID="privacy-sync-toggle-btn"
            size="small"
            variant={isPaused ? 'primary' : 'secondary'}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                if (isPaused) {
                  await backgroundApiProxy.servicePrivacyChain.startForegroundBoost(
                    { networkId, trigger: 'manual-sync' },
                  );
                } else {
                  await backgroundApiProxy.servicePrivacyChain.pauseLocalWalletScan(
                    { networkId },
                  );
                }
              })
            }
          >
            {intl.formatMessage({
              id: isPaused
                ? ETranslations.global_resume
                : ETranslations.global_pause,
            })}
          </Button>
        ) : null}
      </ListItem>
      {/* own row: shares a slot with the pause button otherwise */}
      {ratio === null ? null : (
        <Stack px="$5" pb="$3">
          <Progress
            testID="privacy-sync-progress"
            animated
            value={Math.floor(ratio * 100)}
            height="$1"
          />
        </Stack>
      )}

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
  operation?: 'enable' | 'disable';
  // Turned off with its resume position kept: turning it back on resumes.
  paused?: boolean;
  birthdayTimestamp?: number;
  birthdayHintTimestamp?: number;
  birthdayHeight?: number;
  earliestBirthdayHeight?: number;
  walletIsTemp: boolean;
  deriveLabel?: string;
};

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
    return formatMonth(new Date(entry.birthdayTimestamp));
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
              operation: state.pendingOperation,
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

  // The route may not name a network (the per-wallet entry lists every
  // chain); the network-wide sections below then stay hidden.
  const soleNetworkId =
    networkIdFilter ??
    (entries &&
    entries.length > 0 &&
    entries.every((e) => e.networkId === entries[0].networkId)
      ? entries[0].networkId
      : undefined);

  const [
    {
      dataBlockedNetworkIds,
      pausedNetworkIds,
      storageUnsupportedNetworkIds,
      progress,
    },
  ] = usePrivacyChainAtom();

  // Read progress once on open so figures show at once; published values
  // take over as they arrive from the scheduler.
  const { result: openedProgress } = usePromiseResult(async () => {
    if (!soleNetworkId || !entries) return undefined;
    const enabled = entries.filter(
      (entry) => entry.networkId === soleNetworkId && entry.enabled,
    );
    const read = await Promise.all(
      enabled.map(async (entry) => {
        const value = await backgroundApiProxy.servicePrivacyChain
          .getLocalWalletSyncProgress({
            networkId: entry.networkId,
            accountId: entry.accountId,
          })
          .catch(() => undefined);
        return [`${entry.networkId}:${entry.accountId}`, value] as const;
      }),
    );
    const known: Record<string, ILocalWalletSyncProgress> = {};
    for (const [key, value] of read) {
      if (value) known[key] = value;
    }
    return known;
  }, [soleNetworkId, entries]);
  const shownProgress = useMemo(
    () => ({ ...openedProgress, ...progress }),
    [openedProgress, progress],
  );

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

  // Includes slots this page cannot show.
  const { result: slotUsages } = usePromiseResult(async () => {
    if (!entries || entries.length === 0) return undefined;
    const networkIds = Array.from(
      new Set(entries.map((entry) => entry.networkId)),
    );
    return Promise.all(
      networkIds.map(async (networkId) => ({
        networkId,
        usage:
          await backgroundApiProxy.servicePrivacyChain.getLocalWalletSlotUsage({
            networkId,
          }),
      })),
    );
  }, [entries]);

  const refreshAfterBroadcast = useCallback(() => {
    void refreshEntries();
  }, [refreshEntries]);
  const showUnresolvedBroadcastDialog = useUnresolvedBroadcastDialog(
    refreshAfterBroadcast,
  );

  const askBirthdayAndEnable = useCallback(
    async (entry: IPrivacyAccountEntry) => {
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
              isTempWallet={entry.walletIsTemp}
            />
            <BirthdayDialogForm
              formRef={formRef}
              monthOnly
              earliestBirthday={earliestBirthday}
            />
          </YStack>
        ),
        onConfirmText: intl.formatMessage({ id: ETranslations.global_enable }),
        onConfirm: async ({ preventClose }) => {
          const birthday = readEnableBirthday(
            formRef.current,
            earliestBirthday,
          );
          if (!birthday) {
            preventClose();
            return;
          }
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
          } finally {
            setBusyAccountId(undefined);
          }
        },
      });
    },
    [intl, refreshEntries],
  );

  // A paused account resumes from where it stopped; asking for a month would
  // reset the position and rescan from it.
  const startAccount = useCallback(
    async (entry: IPrivacyAccountEntry) => {
      if (!entry.paused) {
        await askBirthdayAndEnable(entry);
        return;
      }
      setBusyAccountId(entry.accountId);
      try {
        await backgroundApiProxy.servicePrivacyChain.enableLocalWalletAccount({
          networkId: entry.networkId,
          accountId: entry.accountId,
        });
        await refreshEntries();
      } finally {
        setBusyAccountId(undefined);
      }
    },
    [askBirthdayAndEnable, refreshEntries],
  );

  const enableAccount = useCallback(
    async (entry: IPrivacyAccountEntry) => {
      const usage =
        await backgroundApiProxy.servicePrivacyChain.getLocalWalletSlotUsage({
          networkId: entry.networkId,
        });
      if (entry.enabled || usage.max === undefined || usage.used < usage.max) {
        await startAccount(entry);
        return;
      }
      if (usage.occupants.length === 0) {
        Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.privacy_slots_full__title,
          }),
          description: intl.formatMessage(
            {
              id: ETranslations.privacy_slots_full_locked__desc,
            },
            { max: usage.max },
          ),
          onConfirmText: intl.formatMessage({ id: ETranslations.global_ok }),
        });
        return;
      }
      const selectionRef: { current: ISlotSelection } = { current: {} };
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.privacy_slots_full__title,
        }),
        description: intl.formatMessage(
          {
            id: ETranslations.privacy_slots_full__desc,
          },
          {
            used: usage.used,
            max: usage.max,
            accountName: entry.accountName,
          },
        ),
        renderContent: (
          <SlotReplaceForm
            occupants={usage.occupants}
            hiddenCount={usage.hiddenCount}
            selectionRef={selectionRef}
          />
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslations.privacy_slots_turn_off_continue__action,
        }),
        onConfirm: async ({ preventClose }) => {
          const accountId = selectionRef.current.accountId;
          if (!accountId) {
            preventClose();
            return;
          }
          setBusyAccountId(entry.accountId);
          try {
            await backgroundApiProxy.servicePrivacyChain.disableLocalWalletAccount(
              {
                networkId: entry.networkId,
                accountId,
              },
            );
            await refreshEntries();
          } catch (error) {
            if (isUnresolvedPrivacyChainBroadcastError(error)) {
              showUnresolvedBroadcastDialog();
              return;
            }
            throw error;
          } finally {
            setBusyAccountId(undefined);
          }
          await startAccount(entry);
        },
      });
    },
    [intl, refreshEntries, showUnresolvedBroadcastDialog, startAccount],
  );

  const editBirthday = useCallback(
    async (entry: IPrivacyAccountEntry) => {
      const earliestBirthday = await getEarliestBirthday(entry.networkId);
      const formRef: { current: IBirthdayFormState } = {
        current: { mode: 'saved-birthday', month: null },
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
            formRef={formRef}
            currentBirthdayHeight={entry.birthdayHeight}
            earliestBirthday={earliestBirthday}
          />
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslations.privacy_sync_resync__action,
        }),
        onConfirm: async ({ preventClose }) => {
          const { month, fromEarliest } = formRef.current;
          let mode: IBirthdayFormState['mode'] | 'height' =
            formRef.current.mode;
          let birthdayTimestamp: number | undefined;
          let birthdayHeight: number | undefined;
          if (fromEarliest && earliestBirthday) {
            mode = 'height';
            birthdayHeight = earliestBirthday.height;
          } else if (mode === 'month') {
            if (!month) {
              Toast.error({
                title: intl.formatMessage({
                  id: ETranslations.global_select_month,
                }),
              });
              preventClose();
              return;
            }
            birthdayTimestamp = new Date(
              month.getFullYear(),
              month.getMonth(),
              1,
            ).getTime();
          }
          await backgroundApiProxy.servicePrivacyChain.repairLocalChainData({
            networkId: entry.networkId,
            accountId: entry.accountId,
            mode,
            birthdayTimestamp,
            birthdayHeight,
          });
          await refreshEntries();
        },
      });
    },
    [intl, refreshEntries],
  );

  // Turning the switch off keeps the viewing key and scanned history; this removes both.
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
          } catch (error) {
            if (isUnresolvedPrivacyChainBroadcastError(error)) {
              showUnresolvedBroadcastDialog();
              return;
            }
            throw error;
          } finally {
            setBusyAccountId(undefined);
          }
        },
      });
    },
    [intl, refreshEntries, showUnresolvedBroadcastDialog],
  );

  const disableAccount = useCallback(
    async (entry: IPrivacyAccountEntry) => {
      setBusyAccountId(entry.accountId);
      try {
        await backgroundApiProxy.servicePrivacyChain.disableLocalWalletAccount({
          networkId: entry.networkId,
          accountId: entry.accountId,
        });
        await refreshEntries();
      } catch (error) {
        if (isUnresolvedPrivacyChainBroadcastError(error)) {
          showUnresolvedBroadcastDialog();
          return;
        }
        throw error;
      } finally {
        setBusyAccountId(undefined);
      }
    },
    [refreshEntries, showUnresolvedBroadcastDialog],
  );

  const renderAccount = (entry: IPrivacyAccountEntry) => {
    const busy = busyAccountId !== undefined || !!entry.operation;
    let statusId: ETranslations = entry.enabled
      ? ETranslations.global_enabled
      : ETranslations.global_disabled;
    if (entry.paused) {
      statusId = ETranslations.syncing_paused__title;
    }
    let status = intl.formatMessage({ id: statusId });
    if (entry.operation) {
      status = intl.formatMessage({ id: ETranslations.global_processing });
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
          subtitle={[entry.walletName, entry.deriveLabel, status]
            .filter(Boolean)
            .join(' · ')}
        >
          <Switch
            testID={`privacy-network-switch-${entry.accountId}`}
            size={ESwitchSize.small}
            value={entry.enabled || entry.operation === 'enable'}
            disabled={busy}
            onChange={(next) => {
              if (next) {
                void enableAccount(entry);
              } else {
                void disableAccount(entry);
              }
            }}
          />
        </ListItem>
        {/* belongs to the account above, not to the list */}
        <YStack testID={`privacy-network-account-detail-${entry.accountId}`}>
          <Divider mx="$4" />
          {entry.enabled ? (
            <ListItem
              mx="$0"
              testID={`privacy-network-birthday-${entry.accountId}`}
              icon="Calendar2Outline"
              title={intl.formatMessage({
                id: ETranslations.privacy_sync_start__title,
              })}
              subtitle={formatShownBirthday(entry, intl)}
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
              <PrivacyChainNetworkSections
                networkId={soleNetworkId}
                enabledAccountCount={
                  slotUsages?.find(
                    ({ networkId }) => networkId === soleNetworkId,
                  )?.usage.used
                }
                isPaused={pausedNetworkIds.includes(soleNetworkId)}
                isHeldByData={dataBlockedNetworkIds.includes(soleNetworkId)}
                isStorageUnsupported={storageUnsupportedNetworkIds.includes(
                  soleNetworkId,
                )}
                progress={shownProgress}
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
              entries.map(renderAccount)
            )}
            {soleNetworkId ? (
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

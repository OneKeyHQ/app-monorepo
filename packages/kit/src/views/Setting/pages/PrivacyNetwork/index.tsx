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
  Progress,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useIsCellularNetwork } from '@onekeyhq/kit/src/hooks/useIsCellularNetwork';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { AccountManagerTestIDs } from '@onekeyhq/kit/src/views/AccountManagerStacks/testIDs';
import {
  BirthdayDialogForm,
  type IBirthdayFormState,
  PrivacyEnableDisclosure,
} from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls';
import {
  useDevSettingsPersistAtom,
  usePrivacyChainAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ILocalWalletSlotUsage,
  ILocalWalletSyncProgress,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes/accountManagerStacks';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes/setting';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes/setting';
import { formatMonth } from '@onekeyhq/shared/src/utils/dateUtils';
import { isUnresolvedPrivacyChainBroadcastError } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';

import type { RouteProp } from '@react-navigation/core';

const ZcashDebugSettings = LazyLoadPage(
  async () => {
    const { ZcashDebugSettings: Component } =
      await import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ZcashWasmGallery');
    return { default: Component };
  },
  undefined,
  true,
);

// Monero's sync page groups by question ("what is it doing", "where does it
// scan from", "what does it keep"). Same idea here, chain-agnostically.
function SectionTitle({ children }: { children: string }) {
  return (
    <SizableText
      px="$5"
      pt="$5"
      pb="$2"
      size="$bodySm"
      color="$textSubdued"
      letterSpacing={0.6}
    >
      {children}
    </SizableText>
  );
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

// Which scanning account to turn off to make room for another. The list comes
// from the background: slots are held across wallets this page cannot see.
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
                    id: ETranslationsMock.privacy_slots_shared_key,
                    defaultMessage: ETranslationsMock.privacy_slots_shared_key,
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
              id: ETranslationsMock.privacy_slots_locked_wallet_note,
              defaultMessage:
                ETranslationsMock.privacy_slots_locked_wallet_note,
            },
            { count: hiddenCount },
          )}
        </SizableText>
      ) : null}
      <SizableText size="$bodySm" color="$textCaution" px="$5" pt="$2">
        {intl.formatMessage({
          id: ETranslationsMock.privacy_slots_replace_cost,
        })}
      </SizableText>
    </YStack>
  );
}

// Storage is the last section on the page: it is the only one that is not
// about what the chain is doing right now, and its figure covers the whole
// network. Per-account attribution is impossible by design -- the block cache
// and commitment trees are scanned once and serve every viewing key -- so
// deleting one account frees almost nothing.
function PrivacyChainStorageSection({
  storageBytes,
  onChanged,
}: {
  storageBytes: number | null | undefined;
  onChanged: () => void;
}) {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);

  const handleReset = useCallback(() => {
    Dialog.confirm({
      title: intl.formatMessage({
        id: ETranslationsMock.privacy_sync_storage_reset,
      }),
      description: intl.formatMessage({
        id: ETranslationsMock.privacy_sync_storage_reset_desc,
      }),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_reset }),
      onConfirm: async () => {
        setBusy(true);
        try {
          await backgroundApiProxy.servicePrivacyChain.clearTransactionHistoryCache();
          onChanged();
        } finally {
          setBusy(false);
        }
      },
    });
  }, [intl, onChanged]);

  if (storageBytes === undefined) {
    return null;
  }
  return (
    <>
      <SectionTitle>
        {intl.formatMessage({
          id: ETranslationsMock.privacy_sync_section_storage,
        })}
      </SectionTitle>
      <ListItem
        testID="privacy-sync-storage"
        icon="FolderOutline"
        title={intl.formatMessage({
          id: ETranslationsMock.privacy_sync_storage_title,
        })}
        subtitle={intl.formatMessage({
          id: ETranslationsMock.privacy_sync_storage_rebuildable,
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
            disabled={busy || !storageBytes}
            onPress={handleReset}
          >
            {intl.formatMessage({ id: ETranslations.global_reset })}
          </Button>
        </XStack>
      </ListItem>
    </>
  );
}

// The network-wide half of the sync page: what the scanner is doing right now,
// what it is allowed to use, and what it keeps on disk. Per-account settings
// stay one level down -- several accounts share one scan, so a birthday shown
// here would have no owner.
function PrivacyChainNetworkSections({
  networkId,
  isScanning,
  isPaused,
  isHeldByData,
  progress,
  endpointUrl,
  endpointDefaultUrl,
  endpointIsCustom,
  endpointHealth,
  onChanged,
}: {
  networkId: string;
  isScanning: boolean;
  isPaused: boolean;
  isHeldByData: boolean;
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
  const isCellular = useIsCellularNetwork();
  const [busy, setBusy] = useState(false);
  const { result: preferPublicSends, run: refreshPreference } =
    usePromiseResult(
      async () =>
        backgroundApiProxy.servicePrivacyChain.getLocalWalletSendPreference({
          networkId,
        }),
      [networkId],
    );
  const { result: allowCellular, run: refreshAllowCellular } = usePromiseResult(
    async () =>
      backgroundApiProxy.servicePrivacyChain.getAllowPrivacySyncOnCellular(),
    [],
  );
  const { result: publicPoolLabel } = usePromiseResult(async () => {
    const pools =
      await backgroundApiProxy.servicePrivacyChain.getLocalWalletPools({
        networkId,
      });
    return (
      pools.find((pool) => pool.kind === 'public')?.label.toLowerCase() ?? ''
    );
  }, [networkId]);

  // The furthest-behind account decides the headline: accounts share one scan
  // queue, so the slowest one is what "how far along is this chain" means.
  const behind = Object.entries(progress)
    .filter(([key]) => key.startsWith(`${networkId}:`))
    .map(([, value]) => value)
    .filter((value) => !value.isBackfillComplete)
    .map((value) =>
      typeof value.backfillTargetHeight === 'number' &&
      typeof value.backfillScannedHeight === 'number'
        ? {
            remaining: Math.max(
              0,
              value.backfillTargetHeight - value.backfillScannedHeight,
            ),
            ratio: value.backfillProgress,
            scanned: value.backfillScannedHeight,
            target: value.backfillTargetHeight,
          }
        : { remaining: Number.MAX_SAFE_INTEGER, ratio: null },
    )
    .toSorted((left, right) => right.remaining - left.remaining)[0];

  const behindHeights =
    behind &&
    behind.remaining !== Number.MAX_SAFE_INTEGER &&
    typeof behind.scanned === 'number' &&
    typeof behind.target === 'number'
      ? { scanned: behind.scanned, target: behind.target }
      : undefined;

  // Where the shared scan sits at the tip. Once backfill is done every account
  // is at the same height, so this is a fact about the chain, not about any
  // one account -- and a chain never "finishes", it only keeps up.
  const atTip = Object.entries(progress)
    .filter(([key]) => key.startsWith(`${networkId}:`))
    .map(([, value]) => value)
    .find(
      (value) =>
        typeof value.tipScannedHeight === 'number' &&
        typeof value.chainTip === 'number',
    );

  // Only two things actually STOP the scan: the user, and the metered-data
  // gate. `isScanning` is not one of them -- it says whether a FOREGROUND
  // BOOST is running, and using it here painted the ordinary follow-the-tip
  // state with a pause icon and an "Up to date" that claimed a finish line
  // this chain does not have.
  const heldByData = isHeldByData;
  let stateLabel: string;
  let stateIcon: IKeyOfIcons;
  if (isPaused) {
    stateIcon = 'PauseOutline';
    stateLabel = intl.formatMessage({
      id: ETranslationsMock.privacy_scan_paused,
    });
  } else if (heldByData) {
    stateIcon = 'SignalOutline';
    stateLabel = intl.formatMessage({
      id: ETranslationsMock.privacy_scan_state_held,
    });
  } else if (behind) {
    stateIcon = 'RefreshCcwOutline';
    stateLabel = intl.formatMessage({
      id: ETranslationsMock.privacy_scan_state_scanning,
    });
  } else {
    stateIcon = 'RefreshCcwOutline';
    stateLabel = intl.formatMessage({
      id: ETranslationsMock.privacy_sync_state_following,
    });
  }

  // One number for the whole network, and no block heights. There is a single
  // scan; per-account figures differ only because birthdays do, and the worst
  // one is what decides when everything is usable.
  const ratio =
    behind && behind.remaining !== Number.MAX_SAFE_INTEGER
      ? behind.ratio
      : null;
  // One sentence in both states: scanned height / chain tip. The percentage
  // only joins it while backfill is running, because only backfill ends.
  const num = (v: number) => v.toLocaleString('en-US');
  let detail: string | undefined;
  if (behindHeights) {
    detail = [
      `${num(behindHeights.scanned)} / ${num(behindHeights.target)}`,
      ratio === null ? '' : `${Math.floor(ratio * 100)}%`,
    ]
      .filter(Boolean)
      .join(' · ');
  } else if (atTip) {
    detail = `${num(atTip.tipScannedHeight ?? 0)} / ${num(
      atTip.chainTip ?? 0,
    )}`;
  }

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
          id: ETranslationsMock.privacy_sync_section_status,
        })}
      </SectionTitle>
      <ListItem
        testID="privacy-sync-status"
        icon={stateIcon}
        title={stateLabel}
        subtitle={detail}
      >
        {isScanning || isPaused ? (
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
                ? ETranslationsMock.privacy_scan_resume
                : ETranslationsMock.privacy_scan_pause_title,
            })}
          </Button>
        ) : null}
      </ListItem>
      {/* Its own row, full width. In the ListItem's right-hand slot it shared
          one cell with the pause button and the two collided. */}
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

      <SectionTitle>
        {intl.formatMessage({
          id: ETranslationsMock.privacy_sync_section_network,
        })}
      </SectionTitle>
      <ListItem
        testID="privacy-sync-mobile-data"
        icon="SignalOutline"
        title={intl.formatMessage({
          id: ETranslationsMock.privacy_sync_mobile_data_title,
        })}
        subtitle={intl.formatMessage({
          id: ETranslationsMock.privacy_sync_mobile_data_desc,
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
      {/* Network-wide, not per account: which pool a send spends from is a
          statement about this chain, and a per-account copy only raised the
          question of which account a given send would use. */}
      <ListItem
        testID="privacy-prefer-public"
        icon="EyeOutline"
        title={intl.formatMessage(
          {
            id: ETranslationsMock.privacy_prefer_public_title,
            defaultMessage: ETranslationsMock.privacy_prefer_public_title,
          },
          { poolLabel: publicPoolLabel },
        )}
        subtitle={intl.formatMessage({
          id: ETranslationsMock.privacy_prefer_public_desc,
        })}
      >
        <Switch
          testID="privacy-prefer-public-switch"
          size={ESwitchSize.small}
          value={preferPublicSends === true}
          disabled={busy || preferPublicSends === undefined}
          onChange={(next) =>
            void run(() =>
              backgroundApiProxy.servicePrivacyChain.setLocalWalletSendPreference(
                { networkId, preferPublic: next },
              ),
            )
          }
        />
      </ListItem>
      {endpointUrl && endpointDefaultUrl ? (
        <ListItem
          testID="privacy-sync-node"
          icon="GlobusOutline"
          title={intl.formatMessage({
            id: ETranslationsMock.privacy_sync_node_title,
          })}
          subtitle={[
            intl.formatMessage({
              id: endpointIsCustom
                ? ETranslationsMock.privacy_sync_node_custom
                : ETranslationsMock.privacy_sync_node_default,
            }),
            endpointUrl.replace(/^https?:\/\//, ''),
            // What the scan last saw, so "nothing is moving" is attributable to
            // the node instead of looking like a wallet bug. Absent until
            // something has actually scanned.
            // eslint-disable-next-line no-nested-ternary
            endpointHealth === undefined
              ? ''
              : endpointHealth.ok
                ? endpointHealth.latencyMs === null
                  ? ''
                  : intl.formatMessage(
                      {
                        id: ETranslationsMock.privacy_sync_node_latency,
                        defaultMessage:
                          ETranslationsMock.privacy_sync_node_latency,
                      },
                      { ms: endpointHealth.latencyMs },
                    )
                : intl.formatMessage({
                    id: ETranslationsMock.privacy_sync_node_unreachable,
                  }),
          ]
            .filter(Boolean)
            .join(' · ')}
          drillIn
          // Read-only here. Picking a node is the app-wide custom-RPC setting,
          // the same one every other chain uses.
          //
          // pushModal, not push: this page is mounted in two different modal
          // stacks (Setting and AccountManagerStacks), and a bare push of a
          // Setting route throws in the latter.
          // The app-wide custom-RPC page, scoped to this network so it opens
          // on this chain and never asks which chain -- arriving from here
          // already answered that.
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
  birthdayHintTimestamp?: number;
  birthdayHeight?: number;
  walletIsTemp: boolean;
};

// Lists every HD account on a local-wallet network (optionally one wallet or
// one network) with its opt-in switch. Per-account send preferences belong to
// Account Settings (docs/08); this page owns only network-level concerns.
// Everything goes through servicePrivacyChain; nothing here knows which chain
// it is.
export default function PrivacyNetworkSettings({
  walletId: walletIdProp,
}: {
  walletId?: string;
}) {
  const route =
    useRoute<
      RouteProp<
        IModalSettingParamList,
        EModalSettingRoutes.SettingPrivacyNetwork
      >
    >();
  const walletId = walletIdProp ?? route.params?.walletId;
  const networkIdFilter = route.params?.networkId;
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useRouteIsFocused();
  const [devSettings] = useDevSettingsPersistAtom();
  const [busyAccountId, setBusyAccountId] = useState<string | undefined>();

  const { result: title } = usePromiseResult(async () => {
    if (!networkIdFilter) return undefined;
    const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
      networkId: networkIdFilter,
    });
    return network?.name;
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
              operation: state.pendingOperation,
              birthdayHintTimestamp: state.birthdayHintTimestamp,
              birthdayHeight: state.birthdayHeight,
              walletIsTemp: account.walletIsTemp,
            };
          }),
      );
    }, [isFocused, walletId, networkIdFilter]);

  // Which network this page is about. The route may not name one (the
  // per-wallet entry lists every chain), in which case the network-wide
  // sections below have no single subject and stay hidden.
  const soleNetworkId =
    networkIdFilter ??
    (entries &&
    entries.length > 0 &&
    entries.every((e) => e.networkId === entries[0].networkId)
      ? entries[0].networkId
      : undefined);

  const [
    { boostingNetworkIds, dataBlockedNetworkIds, pausedNetworkIds, progress },
  ] = usePrivacyChainAtom();

  const { result: networkInfo, run: refreshNetworkInfo } =
    usePromiseResult(async () => {
      if (!soleNetworkId) return undefined;
      return backgroundApiProxy.servicePrivacyChain.getLocalWalletNetworkInfo({
        networkId: soleNetworkId,
      });
    }, [soleNetworkId]);

  // One line per network; the count includes slots this page cannot show.
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

  const showUnresolvedBroadcastDialog = useCallback(() => {
    Dialog.confirm({
      title: intl.formatMessage({ id: ETranslations.global_retry }),
      description: intl.formatMessage({
        id: ETranslations.global_an_error_occurred_desc,
      }),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_refresh }),
      onConfirm: () => {
        void refreshEntries();
      },
    });
  }, [intl, refreshEntries]);

  const askBirthdayAndEnable = useCallback(
    (entry: IPrivacyAccountEntry, enabledAccountCount = 0) => {
      const formRef: { current: IBirthdayFormState } = {
        current: {
          mode: 'month',
          month:
            typeof entry.birthdayHintTimestamp === 'number'
              ? new Date(entry.birthdayHintTimestamp)
              : null,
          height: '',
        },
      };
      Dialog.confirm({
        title: entry.accountName,
        renderContent: (
          <YStack gap="$4">
            <PrivacyEnableDisclosure
              hasRecommendedMonth={
                typeof entry.birthdayHintTimestamp === 'number'
              }
              isTempWallet={entry.walletIsTemp}
              enabledAccountCount={enabledAccountCount}
            />
            <BirthdayDialogForm formRef={formRef} monthOnly />
          </YStack>
        ),
        onConfirmText: intl.formatMessage({ id: ETranslations.global_enable }),
        onConfirm: async ({ preventClose }) => {
          const { month } = formRef.current;
          if (!month) {
            preventClose();
            return;
          }
          setBusyAccountId(entry.accountId);
          try {
            await backgroundApiProxy.servicePrivacyChain.enableLocalWalletAccount(
              {
                networkId: entry.networkId,
                accountId: entry.accountId,
                birthdayTimestamp: new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  1,
                ).getTime(),
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

  // At the ceiling, enabling is a swap rather than a refusal.
  const enableAccount = useCallback(
    async (entry: IPrivacyAccountEntry) => {
      const usage =
        await backgroundApiProxy.servicePrivacyChain.getLocalWalletSlotUsage({
          networkId: entry.networkId,
        });
      if (entry.enabled || usage.max === undefined || usage.used < usage.max) {
        askBirthdayAndEnable(entry, usage.used);
        return;
      }
      if (usage.occupants.length === 0) {
        Dialog.show({
          title: intl.formatMessage({
            id: ETranslationsMock.privacy_slots_full_title,
          }),
          description: intl.formatMessage(
            {
              id: ETranslationsMock.privacy_slots_full_all_locked_desc,
              defaultMessage:
                ETranslationsMock.privacy_slots_full_all_locked_desc,
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
          id: ETranslationsMock.privacy_slots_full_title,
        }),
        description: intl.formatMessage(
          {
            id: ETranslationsMock.privacy_slots_full_desc,
            defaultMessage: ETranslationsMock.privacy_slots_full_desc,
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
          id: ETranslationsMock.privacy_slots_turn_off_and_continue,
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
          // One was just turned off to make room, so the count this enable
          // lands on is the ceiling again.
          askBirthdayAndEnable(entry, usage.used);
        },
      });
    },
    [askBirthdayAndEnable, intl, refreshEntries, showUnresolvedBroadcastDialog],
  );

  // Same form the token page uses, opened from a row that says what it is.
  // Moving the scan start is the one thing an enabled account can change.
  const editBirthday = useCallback(
    (entry: IPrivacyAccountEntry) => {
      const formRef: { current: IBirthdayFormState } = {
        current: { mode: 'saved-birthday', month: null, height: '' },
      };
      Dialog.confirm({
        title: intl.formatMessage({
          id: ETranslationsMock.privacy_account_birthday_title,
        }),
        description: intl.formatMessage({
          id: ETranslationsMock.privacy_repair_scan_desc,
        }),
        tone: 'warning',
        renderContent: (
          <BirthdayDialogForm
            formRef={formRef}
            currentBirthdayHeight={entry.birthdayHeight}
          />
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslationsMock.privacy_repair_scan_confirm,
        }),
        onConfirm: async ({ preventClose }) => {
          const { mode, month, height } = formRef.current;
          let birthdayTimestamp: number | undefined;
          let birthdayHeight: number | undefined;
          if (mode === 'height') {
            const parsed = Number(height);
            if (!height || !Number.isSafeInteger(parsed) || parsed <= 0) {
              preventClose();
              return;
            }
            birthdayHeight = parsed;
          } else if (mode === 'month') {
            if (!month) {
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

  // The only action here that takes something OFF the device. Turning the
  // switch off stops scanning but keeps the viewing key and the scanned
  // history; this removes both.
  const deleteAccountData = useCallback(
    (entry: IPrivacyAccountEntry) => {
      Dialog.confirm({
        title: intl.formatMessage({
          id: ETranslationsMock.privacy_delete_data_title,
        }),
        description: intl.formatMessage({
          id: ETranslationsMock.privacy_delete_data_desc,
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
    let status = intl.formatMessage({
      id: entry.enabled
        ? ETranslations.global_enabled
        : ETranslations.global_disabled,
    });
    if (entry.operation) {
      status = intl.formatMessage({ id: ETranslations.global_processing });
    }
    return (
      // One card per account. Flat rows put an account's two settings at the
      // same level as the next account's name, and with more than one account
      // there was no way to see which pair belonged to whom.
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
          subtitle={[entry.walletName, status].filter(Boolean).join(' · ')}
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
        {/* Inside the card, under a divider: these belong to the account
            above, not to the list. Two rows rather than two small buttons --
            an account has exactly two decisions, where its scan starts and
            whether its viewing key stays on this device, and each deserves a
            line that says so. Off accounts show neither. */}
        {entry.enabled ? (
          <YStack testID={`privacy-network-account-detail-${entry.accountId}`}>
            <Divider mx="$4" />
            <ListItem
              mx="$0"
              testID={`privacy-network-birthday-${entry.accountId}`}
              icon="Calendar2Outline"
              title={intl.formatMessage({
                id: ETranslationsMock.privacy_account_birthday_title,
              })}
              subtitle={
                entry.birthdayHintTimestamp === undefined
                  ? undefined
                  : formatMonth(new Date(entry.birthdayHintTimestamp))
              }
              drillIn
              onPress={() => editBirthday(entry)}
            />
            <ListItem
              mx="$0"
              testID={`privacy-network-delete-${entry.accountId}`}
              icon="DeleteOutline"
              title={intl.formatMessage({
                id: ETranslationsMock.privacy_account_delete_key_title,
              })}
              subtitle={intl.formatMessage({
                id: ETranslationsMock.privacy_account_delete_key_desc,
              })}
              titleProps={{ color: '$textCritical' }}
              onPress={() => deleteAccountData(entry)}
            />
          </YStack>
        ) : null}
      </YStack>
    );
  };

  return (
    <Page testID="settings-privacy-network-page">
      <Page.Header
        title={
          title ?? intl.formatMessage({ id: ETranslations.trade_privacy_mode })
        }
      />
      <Page.Body>
        {entries ? (
          <ScrollView>
            <Stack px="$5" pt="$4" pb="$2" gap="$1">
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslationsMock.privacy_accounts_section_desc,
                })}
              </SizableText>
              {slotUsages?.map(({ networkId, usage }) =>
                usage.max === undefined ? null : (
                  <SizableText
                    key={networkId}
                    testID={`privacy-slot-usage-${networkId}`}
                    size="$bodySmMedium"
                    color={
                      usage.used >= usage.max ? '$textCaution' : '$textSubdued'
                    }
                  >
                    {[
                      intl.formatMessage(
                        {
                          id: ETranslationsMock.privacy_slots_in_use,
                          defaultMessage:
                            ETranslationsMock.privacy_slots_in_use,
                        },
                        { used: usage.used, max: usage.max },
                      ),
                      usage.hiddenCount > 0
                        ? intl.formatMessage(
                            {
                              id: ETranslationsMock.privacy_slots_held_by_locked_wallet,
                              defaultMessage:
                                ETranslationsMock.privacy_slots_held_by_locked_wallet,
                            },
                            { count: usage.hiddenCount },
                          )
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </SizableText>
                ),
              )}
            </Stack>
            {soleNetworkId ? (
              <PrivacyChainNetworkSections
                networkId={soleNetworkId}
                isScanning={boostingNetworkIds.includes(soleNetworkId)}
                isPaused={pausedNetworkIds.includes(soleNetworkId)}
                isHeldByData={dataBlockedNetworkIds.includes(soleNetworkId)}
                progress={progress}
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
                id: ETranslationsMock.privacy_sync_section_accounts,
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
                storageBytes={networkInfo?.storageBytes}
                onChanged={() => {
                  void refreshNetworkInfo();
                  void refreshEntries();
                }}
              />
            ) : null}
            {devSettings.enabled ? (
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  differenceInCalendarMonths,
  endOfDay,
  startOfDay,
  subMonths,
} from 'date-fns';
import { useIntl } from 'react-intl';

import type {
  IDatePickerRenderTriggerProps,
  IDateRange,
  IPageScreenProps,
} from '@onekeyhq/components';
import {
  DatePicker,
  ESwitchSize,
  Empty,
  Icon,
  IconButton,
  Page,
  SegmentControl,
  SizableText,
  Spinner,
  Stack,
  Switch,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorTriggerBulkExportHistory } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerBulkExportHistory';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EChainSelectorPages,
  EModalBulkExportHistoryRoutes,
  EModalRoutes,
  type IModalBulkExportHistoryParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAccountTransactionRange } from '@onekeyhq/shared/types/history';

import { PageFrame } from '../../Staking/components/PageFrame';
import BulkExportHistoryNetworkTrigger from '../components/BulkExportHistoryNetworkTrigger';
import { useBulkExportHistorySupportedNetworks } from '../hooks/useBulkExportHistorySupportedNetworks';
import {
  buildBulkExportHistoryAccountIdentifierMap,
  getBulkExportHistoryAccountNetworkCompatibility,
  resolveBulkExportHistoryAccountIdentity,
} from '../utils/bulkExportHistoryAccountUtils';

enum EDateRange {
  LastMonth = 'lastMonth',
  Last3Months = 'last3Months',
  Custom = 'custom',
}

function getLocalTimeZoneOffset() {
  // getTimezoneOffset() is minutes behind UTC (UTC+8 => -480). Take abs()
  // BEFORE dividing: Math.floor on a negative value rounds away from zero,
  // which turns half-hour zones like UTC+5:30 into "+06:30".
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const minutes = String(absOffset % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

function getExportHistoryRangeMonths(range: IAccountTransactionRange) {
  const endTimestampMs = Math.min(range.maxTimestampMs, Date.now());
  const startTimestampMs = Math.min(range.minTimestampMs, endTimestampMs);

  // Retention is configured in calendar-month buckets. Counting only complete
  // months makes a 12-month range appear as 11 at timestamp boundaries.
  return Math.max(
    1,
    differenceInCalendarMonths(
      new Date(endTimestampMs),
      new Date(startTimestampMs),
    ),
  );
}

function isDateRangeWithinConstraints(
  range: IDateRange,
  constraints:
    | {
        minDate: Date;
        maxDate: Date;
      }
    | undefined,
) {
  if (!range.start || !range.end || !constraints) {
    return false;
  }

  const startTimestampMs = startOfDay(range.start).getTime();
  const endTimestampMs = endOfDay(range.end).getTime();
  return (
    startTimestampMs <= endTimestampMs &&
    startTimestampMs >= startOfDay(constraints.minDate).getTime() &&
    endTimestampMs <= endOfDay(constraints.maxDate).getTime()
  );
}

function BulkExportHistoryContent({
  route,
}: IPageScreenProps<
  IModalBulkExportHistoryParamList,
  EModalBulkExportHistoryRoutes.BulkExportHistoryModal
>) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const actions = useAccountSelectorActions();
  const {
    networkId: homeNetworkId,
    selectedNetworkIds: initialSelectedNetworkIds,
    accountSelectorSceneUrl,
  } = route.params;

  // Normal entries default to the wallet home account. Starting a new export
  // from a filtered history detail restores that list's selected account.
  // Gate rendering on the sync so a stale persisted selection never flashes.
  const [isAccountSyncReady, setIsAccountSyncReady] = useState(false);
  useEffect(() => {
    void (async () => {
      try {
        await actions.current.syncFromScene({
          from: {
            sceneName: accountSelectorSceneUrl
              ? EAccountSelectorSceneName.bulkExportHistory
              : EAccountSelectorSceneName.home,
            sceneUrl: accountSelectorSceneUrl ?? '',
            sceneNum: 0,
          },
          num: 0,
        });
      } finally {
        setIsAccountSyncReady(true);
      }
    })();
  }, [accountSelectorSceneUrl, actions]);

  const [dateRange, setDateRange] = useState<string | number>(
    EDateRange.LastMonth,
  );
  const [customDateRange, setCustomDateRange] = useState<IDateRange>({
    start: null,
    end: null,
  });
  const [hideRiskyTransactions, setHideRiskyTransactions] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  // The abort signal is NOT wired into the underlying background/HTTP calls
  // (an AbortSignal cannot cross the UI↔bg bridge). It only guards the
  // checkpoints between steps: cancelling prevents creating the task if the
  // request has not been sent yet and prevents navigating to the success page
  // afterwards; an already-in-flight create request still completes server-side.
  const abortControllerRef = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const dateRangeOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.last_1_month__action }),
        value: EDateRange.LastMonth,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.last_3_months__action,
        }),
        value: EDateRange.Last3Months,
      },
      {
        label: intl.formatMessage({ id: ETranslations.transaction_custom }),
        value: EDateRange.Custom,
      },
    ],
    [intl],
  );

  const {
    activeAccount: {
      account,
      dbAccount,
      indexedAccount,
      ready: isAccountReady,
    },
  } = useActiveAccount({ num: 0 });
  const activeAccountId = dbAccount?.id ?? account?.id;
  const exportAccountIdentity = useMemo(
    () =>
      resolveBulkExportHistoryAccountIdentity({
        accountId: activeAccountId,
        indexedAccountId: indexedAccount?.id,
      }),
    [activeAccountId, indexedAccount?.id],
  );
  const accountNetworkCompatibility = useMemo(
    () =>
      getBulkExportHistoryAccountNetworkCompatibility({
        accountIdentity: exportAccountIdentity,
        indexedAccountWalletId: indexedAccount?.walletId,
      }),
    [exportAccountIdentity, indexedAccount?.walletId],
  );
  const isExportAccountSupported = Boolean(exportAccountIdentity);
  const {
    supportedNetworkIds,
    selectedNetworkIds,
    setSelectedNetworkIds,
    networkRangeMap,
    effectiveRange,
    hasRangeData,
    isLoading,
    isRangeLoading,
    hasRangeError,
    hasEmptyRange,
    retryRangeRequest,
  } = useBulkExportHistorySupportedNetworks({
    homeNetworkId,
    initialSelectedNetworkIds,
    accountNetworkCompatibility,
  });
  const hasNoCompatibleExportNetwork = Boolean(
    isExportAccountSupported &&
    accountNetworkCompatibility &&
    supportedNetworkIds.length === 0 &&
    !isLoading &&
    !hasRangeError &&
    !hasEmptyRange,
  );
  const isDateRangeDisabled = useMemo(
    () => isRangeLoading || !hasRangeData,
    [hasRangeData, isRangeLoading],
  );

  const networkSubtitleMap = useMemo(() => {
    if (!networkRangeMap) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(networkRangeMap).map(([networkId, range]) => [
        networkId,
        intl.formatMessage(
          { id: ETranslations.export_range_up_to_months__desc },
          { count: getExportHistoryRangeMonths(range) },
        ),
      ]),
    );
  }, [intl, networkRangeMap]);

  const isSingleNetwork = selectedNetworkIds.length === 1;

  // The hook's effectiveRange is already the intersection across selected
  // networks (narrowest common window); only clamp its end to "now" here.
  const customDateConstraints = useMemo(() => {
    if (!effectiveRange) return undefined;

    const maxTimestampMs = Math.min(effectiveRange.maxTimestampMs, Date.now());
    if (effectiveRange.minTimestampMs >= maxTimestampMs) return undefined;

    return {
      minDate: new Date(effectiveRange.minTimestampMs),
      maxDate: new Date(maxTimestampMs),
    };
  }, [effectiveRange]);

  useEffect(() => {
    setCustomDateRange((currentRange) => {
      if (!currentRange.start || !currentRange.end) {
        return currentRange;
      }
      return isDateRangeWithinConstraints(currentRange, customDateConstraints)
        ? currentRange
        : { start: null, end: null };
    });
  }, [customDateConstraints]);

  const customDateRangeMaxMonths = useMemo(() => {
    if (!customDateConstraints) return undefined;
    return getExportHistoryRangeMonths({
      minTimestampMs: customDateConstraints.minDate.getTime(),
      maxTimestampMs: customDateConstraints.maxDate.getTime(),
    });
  }, [customDateConstraints]);

  const customDateRangeDescription = useMemo(() => {
    if (isSingleNetwork && customDateRangeMaxMonths !== undefined) {
      return intl.formatMessage(
        { id: ETranslations.export_single_network_range__desc },
        { count: customDateRangeMaxMonths },
      );
    }
    return intl.formatMessage({
      id: ETranslations.export_range_multiple_networks__desc,
    });
  }, [customDateRangeMaxMonths, intl, isSingleNetwork]);

  const isCustomDateRangeValid = useMemo(() => {
    if (dateRange !== EDateRange.Custom) return true;
    return isDateRangeWithinConstraints(customDateRange, customDateConstraints);
  }, [customDateConstraints, customDateRange, dateRange]);

  const handleOpenTaskList = useCallback(() => {
    navigation.push(EModalBulkExportHistoryRoutes.BulkExportHistoryTaskList);
  }, [navigation]);

  const renderHeaderRight = useCallback(
    () => (
      <IconButton
        testID="bulk-export-history-task-list-btn"
        title={intl.formatMessage({
          id: ETranslations.export_history__title,
        })}
        variant="tertiary"
        icon="ClockTimeHistoryOutline"
        disabled={isExporting}
        onPress={handleOpenTaskList}
      />
    ),
    [handleOpenTaskList, intl, isExporting],
  );

  const renderDatePickerTrigger = useCallback(
    (props: IDatePickerRenderTriggerProps) => (
      <DatePicker.Trigger {...props} size="large" />
    ),
    [],
  );

  const handleOpenNetworkSelector = useCallback(() => {
    navigation.pushModal(EModalRoutes.ChainSelectorModal, {
      screen: EChainSelectorPages.MultiNetworkSelector,
      params: {
        networkIds: supportedNetworkIds,
        selectedNetworkIds,
        networkSubtitleMap,
        topAlert: {
          icon: 'InfoCircleOutline',
          description: intl.formatMessage({
            id: ETranslations.export_range_multiple_networks__desc,
          }),
        },
        onSelectedNetworkIdsChange: setSelectedNetworkIds,
      },
    });
  }, [
    navigation,
    intl,
    networkSubtitleMap,
    selectedNetworkIds,
    setSelectedNetworkIds,
    supportedNetworkIds,
  ]);

  const handleExport = useCallback(async () => {
    // hasRangeData already implies the selection is non-empty and every
    // selected network is supported (see selectedRangeMap in the hook).
    if (
      abortControllerRef.current ||
      isExporting ||
      !exportAccountIdentity ||
      !hasRangeData
    ) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsExporting(true);

    try {
      // 1. Compute date range
      const now = new Date();
      let minTimestampMs: number;
      let maxTimestampMs: number;

      if (dateRange === EDateRange.Custom) {
        if (!customDateRange.start || !customDateRange.end) return;
        // DatePicker.Range returns midnight of the picked days; expand to the
        // full days so transactions on the end date are included.
        const startDay = new Date(customDateRange.start);
        startDay.setHours(0, 0, 0, 0);
        const endDay = new Date(customDateRange.end);
        endDay.setHours(23, 59, 59, 999);
        minTimestampMs = startDay.getTime();
        maxTimestampMs = endDay.getTime();
      } else if (dateRange === EDateRange.Last3Months) {
        minTimestampMs = subMonths(now, 3).getTime();
        maxTimestampMs = now.getTime();
      } else {
        // LastMonth
        minTimestampMs = subMonths(now, 1).getTime();
        maxTimestampMs = now.getTime();
      }

      // Clamp to the intersection of selected networks' supported ranges
      if (customDateConstraints) {
        minTimestampMs = Math.max(
          minTimestampMs,
          customDateConstraints.minDate.getTime(),
        );
        maxTimestampMs = Math.min(
          maxTimestampMs,
          customDateConstraints.maxDate.getTime(),
        );
      }

      // A preset window (Last month / Last 3 months) may not overlap the
      // supported range at all (e.g. the account's last transaction is older
      // than the preset window), which inverts the clamped range. Block the
      // request instead of creating an empty export task.
      if (minTimestampMs >= maxTimestampMs) {
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.global_no_transactions_yet,
          }),
        });
        return;
      }

      // 2. Build the public account identifiers for every selected network.
      const singletonAccountMetaMap =
        exportAccountIdentity.type === 'singleton'
          ? await backgroundApiProxy.serviceAccount.getAccountMetaForNetworksBatch(
              {
                pairs: selectedNetworkIds.map((networkId) => ({
                  accountId: exportAccountIdentity.accountId,
                  networkId,
                })),
              },
            )
          : undefined;
      const singletonAccountIdentifierMap =
        exportAccountIdentity.type === 'singleton'
          ? buildBulkExportHistoryAccountIdentifierMap({
              networkIds: selectedNetworkIds,
              accountMetaMap: singletonAccountMetaMap,
            }).networkIdToAddressArray
          : undefined;
      const networkIdToAddressEntries = await Promise.all(
        selectedNetworkIds.map(async (networkId) => {
          const addresses: string[] = [];

          const appendAccount = ({
            address,
            xpub,
          }: {
            address: string | undefined;
            xpub: string | undefined;
          }) => {
            if (address) {
              addresses.push(address);
            }
            if (xpub) {
              addresses.push(xpub);
            }
          };

          if (exportAccountIdentity.type === 'singleton') {
            addresses.push(
              ...(singletonAccountIdentifierMap?.[networkId] ?? []),
            );
            return [networkId, addresses] as const;
          }

          const vaultSettings =
            await backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId,
            });

          if (vaultSettings.mergeDeriveAssetsEnabled) {
            // Get accounts for ALL derive types (e.g. BTC Taproot, SegWit, Legacy)
            const { networkAccounts } =
              await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
                {
                  networkId,
                  indexedAccountId: exportAccountIdentity.indexedAccountId,
                  excludeEmptyAccount: true,
                },
              );
            await Promise.all(
              networkAccounts
                .filter((item) => item.account)
                .map(async (item) => {
                  const xpub =
                    await backgroundApiProxy.serviceAccount.getAccountXpub({
                      accountId: item.account!.id,
                      networkId,
                    });
                  appendAccount({
                    address: item.account!.address,
                    xpub: xpub || undefined,
                  });
                }),
            );
          } else {
            // Single derive type — use global derive type
            const deriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                { networkId },
              );
            const { accounts } =
              await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts(
                {
                  indexedAccountIds: [exportAccountIdentity.indexedAccountId],
                  networkId,
                  deriveType,
                },
              );
            const networkAccount = accounts[0];
            if (networkAccount) {
              const xpub =
                await backgroundApiProxy.serviceAccount.getAccountXpub({
                  accountId: networkAccount.id,
                  networkId,
                });
              appendAccount({
                address: networkAccount.address,
                xpub: xpub || undefined,
              });
            }
          }

          return [networkId, addresses] as const;
        }),
      );
      const normalizedAddressEntries = networkIdToAddressEntries.map(
        ([networkId, addresses]) =>
          [networkId, Array.from(new Set(addresses))] as const,
      );
      const missingNetworkIds = normalizedAddressEntries
        .filter(([, addresses]) => addresses.length === 0)
        .map(([networkId]) => networkId);

      if (missingNetworkIds.length) {
        const missingNetworkNames = await Promise.all(
          missingNetworkIds.map(async (networkId) => {
            try {
              const network =
                await backgroundApiProxy.serviceNetwork.getNetwork({
                  networkId,
                });
              return network.name;
            } catch {
              return networkId;
            }
          }),
        );
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.wallet_no_address }),
          message: intl.formatMessage(
            {
              id: ETranslations.export_selected_networks_missing_address__msg,
            },
            { networks: missingNetworkNames.join(', ') },
          ),
        });
        return;
      }

      const networkIdToAddressArray = Object.fromEntries(
        normalizedAddressEntries,
      );

      if (controller.signal.aborted) return;

      // 3. Create the export task; the CSV is generated asynchronously on the server
      await backgroundApiProxy.serviceHistory.createExportTransactionHistoryTask(
        {
          networkIdToAddressArray,
          limit: 10_000,
          minTimestampMs,
          maxTimestampMs,
          onlySafe: hideRiskyTransactions,
          timeZone: getLocalTimeZoneOffset(),
        },
      );

      if (controller.signal.aborted) return;

      navigation.push(
        EModalBulkExportHistoryRoutes.BulkExportHistoryTaskCreated,
      );
    } catch (error) {
      // HTTP errors are auto-toasted by the api client bridge, but local
      // address/xpub resolution errors are not — surface those too instead of
      // failing silently. showToastOfError dedupes already-toasted errors.
      errorToastUtils.toastIfError(error);
      errorToastUtils.showToastOfError(error);
      defaultLogger.app.error.log(
        `Bulk export history task creation failed: ${String(error)}`,
      );
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  }, [
    exportAccountIdentity,
    isExporting,
    hasRangeData,
    selectedNetworkIds,
    dateRange,
    customDateRange,
    customDateConstraints,
    hideRiskyTransactions,
    navigation,
    intl,
  ]);

  const pageHeader = (
    <Page.Header
      title={intl.formatMessage({
        id: ETranslations.global_export_transaction_history,
      })}
      headerRight={renderHeaderRight}
    />
  );

  if (isLoading || !isAccountSyncReady || !isAccountReady) {
    return (
      <Page>
        {pageHeader}
        <Page.Body flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </Page.Body>
      </Page>
    );
  }

  if (hasRangeError) {
    return (
      <Page>
        {pageHeader}
        <Page.Body>
          <PageFrame error onRefresh={retryRangeRequest} />
        </Page.Body>
      </Page>
    );
  }

  if (hasEmptyRange) {
    return (
      <Page>
        {pageHeader}
        <Page.Body>
          <Empty
            pt="$24"
            icon="ClockTimeHistoryOutline"
            title={intl.formatMessage({
              id: ETranslations.global_no_transactions_yet,
            })}
          />
        </Page.Body>
      </Page>
    );
  }

  return (
    <Page scrollEnabled>
      {pageHeader}
      <Page.Body px="$5" pt="$3" gap="$6">
        {/* Export Account */}
        <Stack gap="$1.5">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.global_account })}
          </SizableText>
          <AccountSelectorTriggerBulkExportHistory
            num={0}
            disabled={isExporting}
          />
          {!isExportAccountSupported || hasNoCompatibleExportNetwork ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: hasNoCompatibleExportNetwork
                  ? ETranslations.wallet_unsupported_network_desc
                  : ETranslations.export_account_not_supported__desc,
              })}
            </SizableText>
          ) : null}
        </Stack>

        {/* Network */}
        <Stack gap="$1.5">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.global_network })}
          </SizableText>
          <BulkExportHistoryNetworkTrigger
            selectedNetworkIds={selectedNetworkIds}
            disabled={
              isExporting ||
              hasNoCompatibleExportNetwork ||
              !isExportAccountSupported
            }
            onPress={handleOpenNetworkSelector}
          />
        </Stack>

        {/* Date Range */}
        <Stack gap="$1.5">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({
              id: ETranslations.global_select_date_range,
            })}
          </SizableText>
          <Stack
            opacity={isDateRangeDisabled || isExporting ? 0.5 : 1}
            pointerEvents={isDateRangeDisabled || isExporting ? 'none' : 'auto'}
            gap="$3"
          >
            <SegmentControl
              fullWidth
              value={dateRange}
              options={dateRangeOptions}
              onChange={setDateRange}
            />
            {dateRange === EDateRange.Custom ? (
              <>
                <DatePicker.Range
                  value={customDateRange}
                  onChange={setCustomDateRange}
                  minDate={customDateConstraints?.minDate}
                  maxDate={customDateConstraints?.maxDate}
                  renderTrigger={renderDatePickerTrigger}
                />
                <XStack alignItems="center" gap="$1.5">
                  <Icon
                    name="InfoCircleOutline"
                    size="$4"
                    color="$iconSubdued"
                  />
                  <SizableText flex={1} size="$bodySm" color="$textSubdued">
                    {customDateRangeDescription}
                  </SizableText>
                </XStack>
              </>
            ) : null}
          </Stack>
        </Stack>

        {/* Hide Risky Transactions */}
        <XStack alignItems="center" py="$2" gap="$3">
          <SizableText size="$bodyLgMedium" flex={1}>
            {intl.formatMessage({
              id: ETranslations.exclude_risky_transactions__action,
            })}
          </SizableText>
          <Switch
            testID="bulk-export-history-hide-risky-switch"
            size={ESwitchSize.small}
            value={hideRiskyTransactions}
            disabled={isExporting}
            onChange={setHideRiskyTransactions}
          />
        </XStack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: ETranslations.create_export_task__action,
          })}
          confirmButtonProps={{
            onPress: handleExport,
            disabled:
              !isExportAccountSupported ||
              !hasRangeData ||
              !isCustomDateRangeValid,
            loading: isExporting,
          }}
        />
      </Page.Footer>
    </Page>
  );
}

function BulkExportHistory(
  props: IPageScreenProps<
    IModalBulkExportHistoryParamList,
    EModalBulkExportHistoryRoutes.BulkExportHistoryModal
  >,
) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.bulkExportHistory,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <BulkExportHistoryContent {...props} />
    </AccountSelectorProviderMirror>
  );
}

export default BulkExportHistory;

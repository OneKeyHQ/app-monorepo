import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { differenceInMonths, subMonths } from 'date-fns';
import { useIntl } from 'react-intl';

import type { IDateRange, IPageScreenProps } from '@onekeyhq/components';
import {
  DatePicker,
  ESwitchSize,
  IconButton,
  Page,
  SegmentControl,
  SizableText,
  Spinner,
  Stack,
  Switch,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorTriggerBulkExportHistory } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerBulkExportHistory';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EChainSelectorPages,
  EModalBulkExportHistoryRoutes,
  EModalRoutes,
  type IModalBulkExportHistoryParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAccountTransactionRange } from '@onekeyhq/shared/types/history';

import BulkExportHistoryNetworkTrigger from '../components/BulkExportHistoryNetworkTrigger';
import { useBulkExportHistorySupportedNetworks } from '../hooks/useBulkExportHistorySupportedNetworks';

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

function getExportHistoryRangeMonthsText(range: IAccountTransactionRange) {
  const endTimestampMs = Math.min(range.maxTimestampMs, Date.now());
  const startTimestampMs = Math.min(range.minTimestampMs, endTimestampMs);
  const months = Math.max(
    1,
    differenceInMonths(new Date(endTimestampMs), new Date(startTimestampMs)),
  );

  return `Last ${months} ${months === 1 ? 'month' : 'months'}`;
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
  const { networkId: homeNetworkId } = route.params;

  // Default the selected account to the wallet home account. Gate rendering
  // on the sync so a stale persisted selection never flashes before it lands.
  const [isAccountSyncReady, setIsAccountSyncReady] = useState(false);
  useEffect(() => {
    void (async () => {
      try {
        await actions.current.syncFromScene({
          from: {
            sceneName: EAccountSelectorSceneName.home,
            sceneUrl: '',
            sceneNum: 0,
          },
          num: 0,
        });
      } finally {
        setIsAccountSyncReady(true);
      }
    })();
  }, [actions]);

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

  const dateRangeOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.earn_last_month }),
        value: EDateRange.LastMonth,
      },
      // TODO: i18n — no existing key for "Last 3 months"; add one via the
      // translation workflow before release
      { label: 'Last 3 months', value: EDateRange.Last3Months },
      {
        label: intl.formatMessage({ id: ETranslations.transaction_custom }),
        value: EDateRange.Custom,
      },
    ],
    [intl],
  );

  const {
    activeAccount: { indexedAccount },
  } = useActiveAccount({ num: 0 });
  const {
    supportedNetworkIds,
    selectedNetworkIds,
    setSelectedNetworkIds,
    networkRangeMap,
    effectiveRange,
    hasRangeData,
    isLoading,
    isRangeLoading,
  } = useBulkExportHistorySupportedNetworks({
    homeNetworkId,
  });

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
        getExportHistoryRangeMonthsText(range),
      ]),
    );
  }, [networkRangeMap]);

  const isSingleNetwork = selectedNetworkIds.length === 1;
  const singleNetworkId = isSingleNetwork ? selectedNetworkIds[0] : '';

  const { result: singleNetworkName } = usePromiseResult(
    async () => {
      if (!singleNetworkId) return undefined;
      const network = await backgroundApiProxy.serviceNetwork.getNetwork({
        networkId: singleNetworkId,
      });
      return network.name;
    },
    [singleNetworkId],
    { checkIsFocused: false },
  );

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

  const customDateRangeMaxMonths = useMemo(() => {
    if (!customDateConstraints) return undefined;
    return Math.max(
      1,
      differenceInMonths(
        customDateConstraints.maxDate,
        customDateConstraints.minDate,
      ),
    );
  }, [customDateConstraints]);

  const customDateRangeDescription = useMemo(() => {
    if (
      isSingleNetwork &&
      singleNetworkName &&
      customDateRangeMaxMonths !== undefined
    ) {
      return `${singleNetworkName} supports exporting up to ${customDateRangeMaxMonths} ${customDateRangeMaxMonths === 1 ? 'month' : 'months'} of data.`;
    }
    return 'Selected networks export is limited to the last 6 months. For longer periods, try single-network export.';
  }, [isSingleNetwork, singleNetworkName, customDateRangeMaxMonths]);

  const isCustomDateRangeValid = useMemo(() => {
    if (dateRange !== EDateRange.Custom) return true;
    return Boolean(customDateRange.start && customDateRange.end);
  }, [dateRange, customDateRange]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    navigation.pop();
  }, [navigation]);

  const handleOpenTaskList = useCallback(() => {
    navigation.push(EModalBulkExportHistoryRoutes.BulkExportHistoryTaskList);
  }, [navigation]);

  const renderHeaderRight = useCallback(
    () => (
      <IconButton
        testID="bulk-export-history-task-list-btn"
        variant="tertiary"
        icon="ClockTimeHistoryOutline"
        onPress={handleOpenTaskList}
      />
    ),
    [handleOpenTaskList],
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
          description:
            'If multiple networks are selected, the overall export range is limited to the shortest window among them.',
        },
        onSelectedNetworkIdsChange: setSelectedNetworkIds,
      },
    });
  }, [
    navigation,
    networkSubtitleMap,
    selectedNetworkIds,
    setSelectedNetworkIds,
    supportedNetworkIds,
  ]);

  const handleExport = useCallback(async () => {
    if (!indexedAccount?.id || !selectedNetworkIds.length) return;

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

      // 2. Build per-network address list (handles mergeDeriveAssetsEnabled networks like BTC)
      const networkIdToAddressEntries = await Promise.all(
        selectedNetworkIds.map(async (networkId) => {
          const vaultSettings =
            await backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId,
            });

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

          if (vaultSettings.mergeDeriveAssetsEnabled) {
            // Get accounts for ALL derive types (e.g. BTC Taproot, SegWit, Legacy)
            const { networkAccounts } =
              await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
                {
                  networkId,
                  indexedAccountId: indexedAccount.id,
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
                  indexedAccountIds: [indexedAccount.id],
                  networkId,
                  deriveType,
                },
              );
            const account = accounts[0];
            if (account) {
              const xpub =
                await backgroundApiProxy.serviceAccount.getAccountXpub({
                  accountId: account.id,
                  networkId,
                });
              appendAccount({
                address: account.address,
                xpub: xpub || undefined,
              });
            }
          }

          return [networkId, addresses] as const;
        }),
      );
      const networkIdToAddressArray = Object.fromEntries(
        networkIdToAddressEntries.filter(
          ([, addresses]) => addresses.length > 0,
        ),
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
      console.error(error);
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  }, [
    indexedAccount?.id,
    selectedNetworkIds,
    dateRange,
    customDateRange,
    customDateConstraints,
    hideRiskyTransactions,
    navigation,
  ]);

  if (isLoading || !isAccountSyncReady) {
    return (
      <Page>
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.global_export_transaction_history,
          })}
          headerRight={renderHeaderRight}
        />
        <Page.Body flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </Page.Body>
      </Page>
    );
  }

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_export_transaction_history,
        })}
        headerRight={renderHeaderRight}
      />
      <Page.Body px="$5" pt="$3" gap="$6">
        {/* Export Account */}
        <Stack gap="$1.5">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.global_account })}
          </SizableText>
          <AccountSelectorTriggerBulkExportHistory num={0} />
        </Stack>

        {/* Network */}
        <Stack gap="$1.5">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.global_network })}
          </SizableText>
          <BulkExportHistoryNetworkTrigger
            selectedNetworkIds={selectedNetworkIds}
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
            opacity={isDateRangeDisabled ? 0.5 : 1}
            pointerEvents={isDateRangeDisabled ? 'none' : 'auto'}
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
                />
                <SizableText size="$bodySm" color="$textSubdued">
                  {customDateRangeDescription}
                </SizableText>
              </>
            ) : null}
          </Stack>
        </Stack>

        {/* Hide Risky Transactions */}
        <XStack alignItems="center" py="$2" gap="$3">
          <SizableText size="$bodyLgMedium" flex={1}>
            {intl.formatMessage({
              id: ETranslations.wallet_history_settings_hide_risk_transaction_title,
            })}
          </SizableText>
          <Switch
            testID="bulk-export-history-hide-risky-switch"
            size={ESwitchSize.small}
            value={hideRiskyTransactions}
            onChange={setHideRiskyTransactions}
          />
        </XStack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onCancelText={intl.formatMessage({
            id: ETranslations.global_cancel,
          })}
          cancelButtonProps={{
            onPress: handleCancel,
          }}
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_bulk_copy_addresses_export_csv,
          })}
          confirmButtonProps={{
            onPress: handleExport,
            // Export only supports indexed accounts (HD/HW); disable instead
            // of letting the press fail silently for watch-only/imported ones.
            disabled:
              !indexedAccount?.id || !hasRangeData || !isCustomDateRangeValid,
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

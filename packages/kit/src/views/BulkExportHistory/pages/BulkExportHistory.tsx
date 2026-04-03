import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  differenceInMonths,
  format as formatDateFns,
  subMonths,
} from 'date-fns';
import { useIntl } from 'react-intl';

import type { IDateRange, IPageScreenProps } from '@onekeyhq/components';
import {
  DatePicker,
  ESwitchSize,
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
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EChainSelectorPages,
  type EModalBulkExportHistoryRoutes,
  EModalRoutes,
  type IModalBulkExportHistoryParamList,
} from '@onekeyhq/shared/src/routes';
import csvExporterUtils from '@onekeyhq/shared/src/utils/csvExporterUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAccountTransactionRange } from '@onekeyhq/shared/types/history';

import BulkExportHistoryNetworkTrigger from '../components/BulkExportHistoryNetworkTrigger';
import { useBulkExportHistorySupportedNetworks } from '../hooks/useBulkExportHistorySupportedNetworks';

enum EDateRange {
  LastMonth = 'lastMonth',
  Last3Months = 'last3Months',
  Custom = 'custom',
}

const DATE_RANGE_OPTIONS = [
  { label: 'Last month', value: EDateRange.LastMonth },
  { label: 'Last 3 months', value: EDateRange.Last3Months },
  { label: 'Custom', value: EDateRange.Custom },
];

function getLocalTimeZoneOffset() {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const hours = String(Math.abs(Math.floor(offset / 60))).padStart(2, '0');
  const minutes = String(Math.abs(offset % 60)).padStart(2, '0');
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

  useEffect(() => {
    void actions.current.syncFromScene({
      from: {
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
        sceneNum: 0,
      },
      num: 0,
    });
  }, [actions]);

  const [dateRange, setDateRange] = useState<string | number>(
    EDateRange.LastMonth,
  );
  const [customDateRange, setCustomDateRange] = useState<IDateRange>({
    start: null,
    end: null,
  });
  const [hideRiskyTransactions, setHideRiskyTransactions] = useState(true);
  const [hideDustTransactions, setHideDustTransactions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    activeAccount: { indexedAccount },
  } = useActiveAccount({ num: 0 });
  const {
    supportedNetworkIds,
    selectedNetworkIds,
    setSelectedNetworkIds,
    networkRangeMap,
    selectedRangeMap,
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

  // Compute the intersection range across selected networks (narrowest common window)
  const customDateConstraints = useMemo(() => {
    if (!selectedRangeMap) return undefined;
    const ranges = Object.values(selectedRangeMap);
    if (!ranges.length) return undefined;

    // Intersection: latest start, earliest end
    const minTimestampMs = Math.max(
      ...ranges.map((range) => range.minTimestampMs),
    );
    const maxTimestampMs = Math.min(
      ...ranges.map((range) => range.maxTimestampMs),
      Date.now(),
    );

    if (minTimestampMs >= maxTimestampMs) return undefined;

    return {
      minDate: new Date(minTimestampMs),
      maxDate: new Date(maxTimestampMs),
    };
  }, [selectedRangeMap]);

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

  const handleOpenNetworkSelector = useCallback(() => {
    navigation.pushModal(EModalRoutes.ChainSelectorModal, {
      screen: EChainSelectorPages.MultiNetworkSelector,
      params: {
        title: 'Select networks',
        searchPlaceholder: 'Search networks',
        selectAllLabel: 'Select all',
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
        minTimestampMs = customDateRange.start.getTime();
        maxTimestampMs = customDateRange.end.getTime();
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

      // 2. Build account array
      const networkAccounts =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
          {
            indexedAccountId: indexedAccount.id,
            networkIds: selectedNetworkIds,
          },
        );
      const accountArray = await Promise.all(
        networkAccounts
          .filter((item) => item.account)
          .map(async (item) => {
            const { account, network } = item;
            const xpub =
              await backgroundApiProxy.serviceAccount.getAccountXpub({
                accountId: account!.id,
                networkId: network.id,
              });
            return {
              accountAddress: account!.address,
              networkId: network.id,
              xpub: xpub || undefined,
            };
          }),
      );

      if (controller.signal.aborted) return;

      // 3. Call export API
      const csvData =
        await backgroundApiProxy.serviceHistory.exportTransactionHistory({
          accountArray,
          limit: 1000,
          minTimestampMs,
          maxTimestampMs,
          onlySafe: hideRiskyTransactions,
          withoutDust: hideDustTransactions,
          timeZone: getLocalTimeZoneOffset(),
        });

      if (controller.signal.aborted) return;

      // 4. Generate filename
      const networkPart =
        isSingleNetwork && singleNetworkName
          ? singleNetworkName.toLowerCase().replace(/\s+/g, '_')
          : 'all_networks';

      let datePart: string;
      if (dateRange === EDateRange.Custom) {
        datePart = `${formatDateFns(new Date(minTimestampMs), 'ddMMyy')}_${formatDateFns(new Date(maxTimestampMs), 'ddMMyy')}`;
      } else {
        datePart = formatDateFns(now, 'ddMMyy');
      }

      const filename = `transaction_history_${networkPart}_${datePart}.csv`;

      // 5. Save file
      await csvExporterUtils.exportCSV(csvData, filename, true);

      if (!controller.signal.aborted) {
        navigation.pop();
      }
    } catch (error) {
      console.error(error);
      if (!controller.signal.aborted) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
      }
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
    hideDustTransactions,
    isSingleNetwork,
    singleNetworkName,
    navigation,
    intl,
  ]);

  if (isLoading) {
    return (
      <Page>
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.global_export_transaction_history,
          })}
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
              options={DATE_RANGE_OPTIONS}
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
            size={ESwitchSize.small}
            value={hideRiskyTransactions}
            onChange={setHideRiskyTransactions}
          />
        </XStack>

        {/* Hide Dust Transactions */}
        <XStack alignItems="center" py="$2" gap="$3">
          <SizableText size="$bodyLgMedium" flex={1}>
            {intl.formatMessage({
              id: ETranslations.wallet_history_settings_hide_small_transaction_title,
            })}
          </SizableText>
          <Switch
            size={ESwitchSize.small}
            value={hideDustTransactions}
            onChange={setHideDustTransactions}
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
            disabled: !hasRangeData || !isCustomDateRangeValid,
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  type IDebugRenderTrackerProps,
  SizableText,
  Skeleton,
  Spinner,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import csvExporterUtils from '@onekeyhq/shared/src/utils/csvExporterUtils';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IUserFunding } from '@onekeyhq/shared/types/hyperliquid';

import { usePerpUserFundingHistory } from '../../../hooks/usePerpOrderInfoPanel';
import {
  buildFundingHistoryExportRecords,
  filterFundingHistoryRecords,
  formatFundingHistoryRate,
  getFundingHistoryMarketOptions,
  getFundingHistoryPaymentPresentation,
  getFundingHistorySide,
} from '../fundingHistoryDisplay';
import { calcCellAlign, getColumnStyle } from '../utils';

import {
  CommonTableListView,
  type IColumnConfig,
  type IRenderMode,
} from './CommonTableListView';

import type {
  IFundingHistoryMarketOption,
  IFundingHistorySideFilter,
} from '../fundingHistoryDisplay';

const FUNDING_HISTORY_PAGE_SIZE = 20;

const balanceFormatter = {
  formatter: 'balance' as const,
};

const valueFormatter = {
  formatter: 'value' as const,
  formatterOptions: {
    currency: '$',
  },
};

function FundingHistoryExportAction({
  isMobile,
  sideFilter,
  marketFilter,
}: {
  isMobile?: boolean;
  sideFilter: IFundingHistorySideFilter;
  marketFilter?: string;
}) {
  const intl = useIntl();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [isExporting, setIsExporting] = useState(false);
  const isExportingRef = useRef(false);
  const accountAddress = activeAccount.accountAddress;
  const actionLabel = intl.formatMessage({
    id: ETranslations.export_data__action,
  });

  const handleExport = useCallback(async () => {
    if (!accountAddress || isExportingRef.current) {
      return;
    }

    isExportingRef.current = true;
    setIsExporting(true);
    try {
      const records =
        await backgroundApiProxy.serviceHyperliquid.getUserFundingHistory({
          accountAddress,
        });
      const exportRecords = buildFundingHistoryExportRecords({
        records,
        sideFilter,
        marketFilter,
        longLabel: intl.formatMessage({ id: ETranslations.perp_long }),
        shortLabel: intl.formatMessage({ id: ETranslations.perp_short }),
      });

      if (exportRecords.length === 0) {
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.global_no_data }),
        });
        return;
      }

      const timeLabel = intl.formatMessage({
        id: ETranslations.global_time,
      });
      const marketLabel = intl.formatMessage({
        id: ETranslations.global_market,
      });
      const sizeLabel = intl.formatMessage({
        id: ETranslations.perp_open_orders_size,
      });
      const sideLabel = intl.formatMessage({
        id: ETranslations.perp_funding_side__label,
      });
      const paymentLabel = intl.formatMessage({
        id: ETranslations.perp_funding_payment__label,
      });
      const rateLabel = intl.formatMessage({
        id: ETranslations.perp_funding_rate__label,
      });
      const csvRows = exportRecords.map((record) => ({
        [timeLabel]: record.time,
        [marketLabel]: record.market,
        [sizeLabel]: record.size,
        [sideLabel]: record.side,
        [paymentLabel]: record.payment,
        [rateLabel]: record.rate,
      }));
      const filename = `perp_funding_history_${formatTime(new Date(), {
        formatTemplate: 'yyyyLLdd-HHmmss',
      })}.csv`;
      const saved = await csvExporterUtils.exportCSV(csvRows, filename);

      if (saved) {
        Toast.success({
          title: intl.formatMessage({ id: ETranslations.global_success }),
        });
      } else {
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.global_failed }),
        });
      }
    } catch (error) {
      defaultLogger.app.error.log(
        `Perp funding history CSV export failed: ${String(error)}`,
      );
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.global_failed }),
      });
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
  }, [accountAddress, intl, marketFilter, sideFilter]);

  if (isMobile) {
    const isDisabled = !accountAddress || isExporting;

    return (
      <XStack
        testID="perp-funding-history-export"
        alignItems="center"
        justifyContent="center"
        cursor={isDisabled ? 'default' : 'pointer'}
        userSelect="none"
        hitSlop={8}
        px="$2"
        py="$1"
        borderRadius="$4"
        bg="$bgActive"
        opacity={!accountAddress ? 0.5 : 1}
        hoverStyle={isDisabled ? undefined : { bg: '$bgStrongHover' }}
        pressStyle={isDisabled ? undefined : { bg: '$bgStrongActive' }}
        accessibilityLabel={actionLabel}
        onPress={isDisabled ? undefined : handleExport}
      >
        <SizableText
          size="$bodySmMedium"
          numberOfLines={1}
          opacity={isExporting ? 0 : 1}
        >
          {actionLabel}
        </SizableText>
        {isExporting ? (
          <Spinner position="absolute" size="small" scale={0.65} />
        ) : null}
      </XStack>
    );
  }

  return (
    <Button
      testID="perp-funding-history-export"
      variant="tertiary"
      size="small"
      accessibilityLabel={actionLabel}
      loading={isExporting}
      disabled={!accountAddress}
      onPress={handleExport}
    >
      {actionLabel}
    </Button>
  );
}

function MobileFundingHistoryLoadingSkeleton() {
  return (
    <YStack>
      {[0, 1, 2, 3].map((index) => (
        <YStack
          key={index}
          mx="$5"
          my="$2"
          p="$4"
          bg="$bgSubdued"
          borderRadius="$3"
          gap="$3"
        >
          <XStack justifyContent="space-between">
            <YStack gap="$1">
              <Skeleton w="$16" h="$3.5" />
              <Skeleton w="$24" h="$3" />
            </YStack>
            <YStack gap="$1" alignItems="flex-end">
              <Skeleton w="$10" h="$2.5" />
              <Skeleton w="$16" h="$3.5" />
            </YStack>
          </XStack>
          <XStack justifyContent="space-between">
            <Skeleton w="$20" h="$3" />
            <Skeleton w="$16" h="$3" />
          </XStack>
        </YStack>
      ))}
    </YStack>
  );
}

function FundingHistoryRow({
  record,
  isMobile,
  cellMinWidth,
  columnConfigs,
  index,
  renderMode = 'full',
  isHovered,
  onHoverChange,
}: {
  record: IUserFunding;
  isMobile?: boolean;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  index: number;
  renderMode?: IRenderMode;
  isHovered?: boolean;
  onHoverChange?: (index: number | null) => void;
}) {
  const intl = useIntl();
  const { delta } = record;
  const date = new Date(record.time);
  const dateInfo = {
    date: formatTime(date, { formatTemplate: 'yyyy-LL-dd' }),
    time: formatTime(date, { formatTemplate: 'HH:mm:ss' }),
  };
  const market = parseDexCoin(delta.coin).displayName;
  const side = getFundingHistorySide(delta.szi);
  let sideInfo: {
    color: '$green11' | '$red11' | '$textSubdued';
    text: string;
  } = { color: '$textSubdued', text: '--' };
  if (side === 'long') {
    sideInfo = {
      color: '$green11',
      text: intl.formatMessage({ id: ETranslations.perp_long }),
    };
  } else if (side === 'short') {
    sideInfo = {
      color: '$red11',
      text: intl.formatMessage({ id: ETranslations.perp_short }),
    };
  }
  const absoluteSize = new BigNumber(delta.szi).abs();
  const formattedSize = absoluteSize.isFinite()
    ? numberFormat(absoluteSize.toFixed(), balanceFormatter)
    : '--';
  const size =
    formattedSize === '--' ? formattedSize : `${formattedSize} ${market}`;
  const paymentPresentation = getFundingHistoryPaymentPresentation(delta.usdc);
  const payment = {
    ...paymentPresentation,
    formatted: numberFormat(paymentPresentation.absoluteAmount, valueFormatter),
  };
  const fundingRate = formatFundingHistoryRate(delta.fundingRate);

  if (isMobile) {
    return (
      <YStack mx="$5" my="$2" p="$4" bg="$bgSubdued" borderRadius="$3" gap="$3">
        <XStack justifyContent="space-between" gap="$3">
          <YStack flex={1} gap="$1">
            <XStack gap="$2" alignItems="center">
              <SizableText size="$bodyMdMedium">{market}</SizableText>
              <SizableText size="$bodySmMedium" color={sideInfo.color}>
                {sideInfo.text}
              </SizableText>
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {dateInfo.date} {dateInfo.time}
            </SizableText>
          </YStack>
          <YStack alignItems="flex-end" gap="$1">
            <SizableText size="$bodyXs" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_funding_payment__label,
              })}
            </SizableText>
            <SizableText size="$bodyMdMedium" color={payment.color}>
              {payment.sign}
              {payment.formatted}
            </SizableText>
          </YStack>
        </XStack>
        <XStack justifyContent="space-between" gap="$4">
          <YStack flex={1} gap="$1">
            <SizableText size="$bodyXs" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.perp_open_orders_size })}
            </SizableText>
            <SizableText size="$bodySm">{size}</SizableText>
          </YStack>
          <YStack flex={1} gap="$1" alignItems="flex-end">
            <SizableText size="$bodyXs" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_funding_rate__label,
              })}
            </SizableText>
            <SizableText size="$bodySm">{fundingRate}</SizableText>
          </YStack>
        </XStack>
      </YStack>
    );
  }

  let backgroundColor = '$bgApp';
  if (isHovered) {
    backgroundColor = '$bgHover';
  } else if (index % 2 === 1) {
    backgroundColor = '$bgSubdued';
  }
  const cells = [
    <YStack key="time">
      <SizableText numberOfLines={1} size="$bodySm">
        {dateInfo.date}
      </SizableText>
      <SizableText numberOfLines={1} size="$bodySm" color="$textSubdued">
        {dateInfo.time}
      </SizableText>
    </YStack>,
    <SizableText key="market" numberOfLines={1} size="$bodySmMedium">
      {market}
    </SizableText>,
    <SizableText key="size" numberOfLines={1} size="$bodySm">
      {size}
    </SizableText>,
    <SizableText
      key="side"
      numberOfLines={1}
      size="$bodySm"
      color={sideInfo.color}
    >
      {sideInfo.text}
    </SizableText>,
    <SizableText
      key="payment"
      numberOfLines={1}
      size="$bodySm"
      color={payment.color}
    >
      {payment.sign}
      {payment.formatted}
    </SizableText>,
    <SizableText key="rate" numberOfLines={1} size="$bodySm">
      {fundingRate}
    </SizableText>,
  ];

  return (
    <XStack
      flex={1}
      py="$1.5"
      pl="$5"
      pr="$3"
      alignItems="center"
      minHeight={48}
      minWidth={renderMode === 'full' ? cellMinWidth : undefined}
      backgroundColor={backgroundColor}
      onHoverIn={() => onHoverChange?.(index)}
      onHoverOut={() => onHoverChange?.(null)}
    >
      {cells.map((content, columnIndex) => (
        <XStack
          key={columnConfigs[columnIndex].key}
          {...getColumnStyle(columnConfigs[columnIndex])}
          alignItems="center"
          justifyContent={calcCellAlign(columnConfigs[columnIndex].align)}
        >
          {content}
        </XStack>
      ))}
    </XStack>
  );
}

interface IPerpFundingHistoryListProps {
  isActive?: boolean;
  isMobile?: boolean;
  useTabsList?: boolean;
  sideFilter?: IFundingHistorySideFilter;
  marketFilter?: string;
  onMarketOptionsChange?: (options: IFundingHistoryMarketOption[]) => void;
}

function PerpFundingHistoryList({
  isActive = true,
  isMobile,
  useTabsList,
  sideFilter = 'all',
  marketFilter,
  onMarketOptionsChange,
}: IPerpFundingHistoryListProps) {
  const intl = useIntl();
  const { accountAddress, records, isError, isLoading, refresh } =
    usePerpUserFundingHistory({ isActive });
  const [currentListPage, setCurrentListPage] = useState(1);

  useEffect(() => {
    setCurrentListPage(1);
  }, [accountAddress, marketFilter, sideFilter]);

  const marketOptions = useMemo(
    () => getFundingHistoryMarketOptions(records),
    [records],
  );
  useEffect(() => {
    onMarketOptionsChange?.(marketOptions);
  }, [marketOptions, onMarketOptionsChange]);

  const filteredRecords = useMemo(
    () => filterFundingHistoryRecords({ records, sideFilter, marketFilter }),
    [marketFilter, records, sideFilter],
  );

  const sortedRecords = useMemo(
    () =>
      filteredRecords.toSorted(
        (a, b) => b.time - a.time || b.hash.localeCompare(a.hash),
      ),
    [filteredRecords],
  );
  const hasActiveFilter = sideFilter !== 'all' || marketFilter !== undefined;
  const columnsConfig: IColumnConfig[] = useMemo(
    () => [
      {
        key: 'time',
        title: intl.formatMessage({ id: ETranslations.global_time }),
        minWidth: 140,
        flex: 1,
        align: 'left',
      },
      {
        key: 'market',
        title: intl.formatMessage({ id: ETranslations.global_market }),
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      {
        key: 'size',
        title: intl.formatMessage({ id: ETranslations.perp_open_orders_size }),
        minWidth: 150,
        flex: 1,
        align: 'left',
      },
      {
        key: 'side',
        title: intl.formatMessage({
          id: ETranslations.perp_funding_side__label,
        }),
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      {
        key: 'payment',
        title: intl.formatMessage({
          id: ETranslations.perp_funding_payment__label,
        }),
        minWidth: 140,
        flex: 1,
        align: 'left',
      },
      {
        key: 'rate',
        title: intl.formatMessage({
          id: ETranslations.perp_funding_rate__label,
        }),
        minWidth: 120,
        flex: 1,
        align: 'right',
      },
    ],
    [intl],
  );
  const totalMinWidth = useMemo(
    () =>
      columnsConfig.reduce(
        (sum, column) => sum + (column.width || column.minWidth || 0),
        0,
      ),
    [columnsConfig],
  );
  const renderFundingHistoryRow = useCallback(
    (
      record: IUserFunding,
      index: number,
      renderMode?: IRenderMode,
      isHovered?: boolean,
      onHoverChange?: (rowIndex: number | null) => void,
    ) => (
      <FundingHistoryRow
        record={record}
        isMobile={isMobile}
        cellMinWidth={totalMinWidth}
        columnConfigs={columnsConfig}
        index={index}
        renderMode={renderMode}
        isHovered={isHovered}
        onHoverChange={onHoverChange}
      />
    ),
    [columnsConfig, isMobile, totalMinWidth],
  );
  const errorState = isError ? (
    <YStack flex={1} alignItems="center" justifyContent="center" gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.global_failed })}
      </SizableText>
      <Button
        testID="perp-funding-history-retry"
        size="small"
        variant="secondary"
        onPress={refresh}
      >
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </YStack>
  ) : undefined;

  return (
    <CommonTableListView
      onPullToRefresh={refresh}
      listViewDebugRenderTrackerProps={useMemo(
        (): IDebugRenderTrackerProps => ({
          name: 'PerpFundingHistoryList',
          position: 'top-left',
        }),
        [],
      )}
      useTabsList={useTabsList}
      currentListPage={currentListPage}
      setCurrentListPage={setCurrentListPage}
      enablePagination
      paginationToBottom={isMobile}
      pageSize={FUNDING_HISTORY_PAGE_SIZE}
      columns={columnsConfig}
      minTableWidth={totalMinWidth}
      data={sortedRecords}
      isMobile={isMobile}
      renderRow={renderFundingHistoryRow}
      keyExtractor={(record) =>
        `${record.hash}-${record.time}-${record.delta.coin}`
      }
      listLoading={isLoading}
      ListEmptyComponent={errorState}
      paginationAction={
        !isMobile ? (
          <FundingHistoryExportAction
            sideFilter={sideFilter}
            marketFilter={marketFilter}
          />
        ) : null
      }
      mobileLoadingComponent={
        isMobile ? <MobileFundingHistoryLoadingSkeleton /> : undefined
      }
      emptyMessage={
        hasActiveFilter && records.length > 0
          ? intl.formatMessage({
              id: ETranslations.perp_funding_history_no_match__title,
            })
          : intl.formatMessage({
              id: ETranslations.perp_funding_history_empty__title,
            })
      }
      emptySubMessage={
        hasActiveFilter && records.length > 0
          ? intl.formatMessage({
              id: ETranslations.perp_funding_history_filter_hint__desc,
            })
          : intl.formatMessage({
              id: ETranslations.perp_funding_history_empty__desc,
            })
      }
    />
  );
}

export { FundingHistoryExportAction, PerpFundingHistoryList };

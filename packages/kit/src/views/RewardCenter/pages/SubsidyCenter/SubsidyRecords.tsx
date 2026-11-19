import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  Icon,
  IconButton,
  NumberSizeableText,
  Page,
  Pagination,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import {
  SUBSIDY_RECENT_RECORD_LIMIT,
  getSubsidyPageCount,
  getSubsidyPageSize,
  isSubsidyPagePastEnd,
} from './subsidyRecordUtils';
import {
  useSubsidyHistoryPage,
  useSubsidyRecordsRefresh,
} from './useSubsidyRecords';

import type {
  ISubsidyHistoryView,
  ISubsidyQuery,
  ISubsidyRecordListItem,
} from './useSubsidyRecords';
import type { LayoutChangeEvent } from 'react-native';

// TODO(OK-67058): move to i18n keys once the copy is final.
export const subsidyRecordsCopy = {
  title: '补贴记录',
  empty: '暂无补贴记录',
  loadFailed: '补贴记录暂时无法加载',
  partial: '部分记录暂时无法加载',
  timeWindow: '最近 90 天',
};

const cardStyle = {
  p: '$4',
  bg: '$bgSubdued',
  borderRadius: '$6',
  borderCurve: 'continuous',
  overflow: 'hidden',
} as const;

function SubsidyRecordList({
  items,
  rowHeight,
}: {
  items: ISubsidyRecordListItem[];
  rowHeight?: number;
}) {
  const headingSize = rowHeight === undefined ? '$headingMd' : '$headingSm';
  return (
    <YStack gap={rowHeight === undefined ? '$6' : undefined}>
      {items.map((record) => (
        <XStack
          key={record.id}
          minHeight={rowHeight}
          alignItems="center"
          gap="$3"
          testID="subsidy-record-row"
        >
          <Stack
            width="$8"
            height="$8"
            flexShrink={0}
            alignItems="center"
            justifyContent="center"
          >
            <Icon name={record.icon} size="$6" color="$iconSubdued" />
          </Stack>
          <YStack flex={1} minWidth={0} gap="$1">
            <XStack alignItems="baseline" gap="$3">
              <SizableText size={headingSize} flex={1} numberOfLines={1}>
                {record.title}
              </SizableText>
              {record.amountUsd ? (
                <NumberSizeableText
                  size={headingSize}
                  color="$textSuccess"
                  flexShrink={0}
                  formatter="value"
                  formatterOptions={{ currency: '$' }}
                >
                  {record.amountUsd}
                </NumberSizeableText>
              ) : (
                <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
                  {record.statusLabel}
                </SizableText>
              )}
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {record.networkName} ·{' '}
              {formatDate(record.createdAt, { hideTimeForever: true })}
            </SizableText>
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

// Height of one record row in the overview card: a 24px title, a 4px gap and
// a 16px caption. The loading placeholder and the empty state take exactly
// this height, so an account without records sees no reflow when the list
// resolves, and one with records only grows downwards.
const recentRecordRowHeight = 44;

function SubsidyRecordSkeleton({
  rowHeight,
  rows = 3,
}: {
  rowHeight?: number;
  rows?: number;
}) {
  return (
    <YStack gap={rowHeight === undefined ? '$6' : undefined}>
      {Array.from({ length: rows }, (_, index) => (
        <XStack
          key={index}
          minHeight={rowHeight ?? recentRecordRowHeight}
          alignItems="center"
          gap="$3"
        >
          <Skeleton width="$8" height="$8" radius="round" />
          <YStack flex={1} gap="$1">
            <Skeleton.HeadingSm />
            <Skeleton.BodySm />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

function SubsidyNotice({ children }: { children: string }) {
  return (
    <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
      {children}
    </SizableText>
  );
}

function SubsidyLoadFailed({
  message,
  onRetry,
  testID,
}: {
  message: string;
  onRetry: () => void;
  testID: string;
}) {
  const intl = useIntl();
  return (
    <YStack alignItems="center" gap="$3" py="$2" testID={testID}>
      <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
        {message}
      </SizableText>
      <Button size="small" onPress={onRetry} testID={`${testID}-retry`}>
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </YStack>
  );
}

// Inline retry for the totals, which load separately from the record list:
// the summary fails as a whole whenever one of its sources is unavailable.
// `compact` keeps it to one row so the desktop sidebar does not grow.
export function SubsidySummaryLoadFailed({
  onRetry,
  compact = false,
}: {
  onRetry: () => void;
  compact?: boolean;
}) {
  const intl = useIntl();
  const message = '补贴统计暂时无法加载';
  const testID = 'subsidy-summary-error';
  if (!compact) {
    return (
      <SubsidyLoadFailed message={message} onRetry={onRetry} testID={testID} />
    );
  }
  return (
    <XStack mt="$2" alignItems="center" gap="$3" testID={testID}>
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        flex={1}
        minWidth={0}
        numberOfLines={1}
      >
        {message}
      </SizableText>
      <Button
        size="small"
        variant="tertiary"
        flexShrink={0}
        onPress={onRetry}
        testID={`${testID}-retry`}
      >
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </XStack>
  );
}

// The most recent records on the mobile overview.
export function SubsidyRecentRecords({
  query,
}: {
  query: ISubsidyQuery<ISubsidyHistoryView>;
}) {
  const { data, isLoading, isError, reload } = query;
  let content;
  if (isError) {
    content = (
      <SubsidyLoadFailed
        message={subsidyRecordsCopy.loadFailed}
        onRetry={reload}
        testID="subsidy-records-error"
      />
    );
  } else if (isLoading || !data) {
    content = <SubsidyRecordSkeleton rows={1} />;
  } else if (data.items.length === 0) {
    // A partial result is not "no records": say what happened instead.
    content = (
      <YStack minHeight={recentRecordRowHeight} justifyContent="center">
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {data.isPartial
            ? subsidyRecordsCopy.partial
            : subsidyRecordsCopy.empty}
        </SizableText>
      </YStack>
    );
  } else {
    content = (
      <>
        <SubsidyRecordList
          items={data.items.slice(0, SUBSIDY_RECENT_RECORD_LIMIT)}
        />
        {data.isPartial ? (
          <SubsidyNotice>{subsidyRecordsCopy.partial}</SubsidyNotice>
        ) : null}
      </>
    );
  }
  return (
    <YStack {...cardStyle} gap="$4" testID="subsidy-recent-records">
      {content}
    </YStack>
  );
}

// Space the pager takes under the list. It is kept even when there is a
// single page: the list area above must not change height when the pager
// appears, because its height decides how many records a page holds.
const pagerHeight = 36;

// Previous / next for the case where the server could not count the records,
// so the number of pages is unknown.
function SubsidyPrevNext({
  page,
  hasNext,
  onChange,
}: {
  page: number;
  hasNext: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <XStack alignItems="center" gap="$2" testID="subsidy-history-prev-next">
      <IconButton
        icon="ChevronLeftSmallOutline"
        variant="tertiary"
        size="small"
        disabled={page <= 1}
        onPress={() => onChange(page - 1)}
        testID="subsidy-history-prev"
      />
      <SizableText size="$bodyMdMedium" fontVariant={['tabular-nums']}>
        {page}
      </SizableText>
      <IconButton
        icon="ChevronRightSmallOutline"
        variant="tertiary"
        size="small"
        disabled={!hasNext}
        onPress={() => onChange(page + 1)}
        testID="subsidy-history-next"
      />
    </XStack>
  );
}

// The full record list, one page at a time: the desktop panel (`compact`)
// and the mobile history page. A page holds as many records as fit the list
// area, so it never scrolls; the page size therefore follows the layout.
export function SubsidyRecordsPaged({
  identity,
  compact = false,
}: {
  identity: string | undefined;
  compact?: boolean;
}) {
  const rowHeight = compact ? 52 : 64;
  const [pageSize, setPageSize] = useState<number>();
  const [page, setPage] = useState(1);
  const query = useSubsidyHistoryPage(identity, { page, pageSize });
  const { data, isLoading, isError, isPreviousData, isFetching, reload } =
    query;

  // A claim or a redemption added a record for this member: the newest page
  // is the one that changed, and it is also the page that carries the new
  // total.
  useSubsidyRecordsRefresh(identity, () => {
    if (page === 1) {
      reload();
    } else {
      setPage(1);
    }
  });

  // Only a first page carries the total; it stands for the later pages.
  const [total, setTotal] = useState<number | null>();
  const pageTotal = isPreviousData ? undefined : data?.total;
  useEffect(() => {
    if (pageTotal !== undefined) {
      setTotal(pageTotal);
    }
  }, [pageTotal]);

  const handleListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      if (height <= 0) {
        return;
      }
      const next = getSubsidyPageSize(height, rowHeight);
      setPageSize((prev) => {
        if (prev !== undefined && prev !== next) {
          // Page boundaries moved; the current page number no longer means
          // the same records.
          setPage(1);
        }
        return next;
      });
    },
    [rowHeight],
  );

  const isPastEnd = isSubsidyPagePastEnd({
    page,
    isSettled: !isPreviousData && !isLoading && !isFetching,
    itemCount: data?.items.length,
    isPartial: data?.isPartial,
    hasMore: data?.hasMore,
  });
  useEffect(() => {
    if (isPastEnd) {
      setPage(1);
    }
  }, [isPastEnd]);

  const pageCount = getSubsidyPageCount(total, pageSize);

  let content;
  if (isError) {
    content = (
      <YStack flex={1} justifyContent="center">
        <SubsidyLoadFailed
          message={subsidyRecordsCopy.loadFailed}
          onRetry={reload}
          testID="subsidy-records-error"
        />
      </YStack>
    );
  } else if (isLoading || !data) {
    content = (
      <SubsidyRecordSkeleton rowHeight={rowHeight} rows={pageSize ?? 3} />
    );
  } else if (data.items.length === 0) {
    content = data.isPartial ? (
      <YStack flex={1} justifyContent="center">
        <SubsidyLoadFailed
          message={subsidyRecordsCopy.partial}
          onRetry={reload}
          testID="subsidy-records-partial"
        />
      </YStack>
    ) : (
      <Empty
        flex={1}
        {...(compact
          ? {
              illustration: 'Orders',
              title: subsidyRecordsCopy.empty,
              titleProps: { size: '$headingMd' },
            }
          : {
              illustration: 'Document',
              illustrationProps: { size: 88, mb: '$1' },
              description: subsidyRecordsCopy.empty,
              descriptionProps: { size: '$bodyMd' },
            })}
      />
    );
  } else {
    content = (
      // The rows fit by construction; the scroll view only matters when a
      // large system font makes a row taller than its nominal height.
      <ScrollView flex={1} opacity={isPreviousData ? 0.5 : 1}>
        <SubsidyRecordList items={data.items} rowHeight={rowHeight} />
      </ScrollView>
    );
  }

  const list = (
    <YStack flex={1} minHeight={0} gap="$3" testID="subsidy-records-panel">
      <XStack alignItems="center" gap="$3">
        <SizableText size="$bodySm" color="$textSubdued" flex={1}>
          {subsidyRecordsCopy.timeWindow}
        </SizableText>
        {data?.isPartial && data.items.length > 0 ? (
          <SizableText size="$bodySm" color="$textSubdued" flexShrink={0}>
            {subsidyRecordsCopy.partial}
          </SizableText>
        ) : null}
      </XStack>
      <YStack flex={1} minHeight={0} onLayout={handleListLayout}>
        {content}
      </YStack>
    </YStack>
  );

  let pager = null;
  if (pageCount !== undefined) {
    if (pageCount > 1) {
      pager = (
        <Pagination
          current={Math.min(page, pageCount)}
          total={pageCount}
          siblingCount={0}
          onChange={setPage}
          testID={
            compact
              ? 'subsidy-desktop-history-pagination'
              : 'subsidy-history-pagination'
          }
        />
      );
    }
  } else if (total === null && (page > 1 || data?.hasMore)) {
    pager = (
      <SubsidyPrevNext
        page={page}
        hasNext={Boolean(data?.hasMore) && !isPreviousData}
        onChange={setPage}
      />
    );
  }
  const pagerRow = (
    <XStack
      height={pagerHeight}
      flexShrink={0}
      alignItems="center"
      justifyContent={compact ? 'flex-end' : 'center'}
    >
      {pager}
    </XStack>
  );

  if (compact) {
    return (
      <YStack flex={1} minHeight={0} gap="$3">
        {list}
        {pagerRow}
      </YStack>
    );
  }

  return (
    <Page>
      <Page.Header title={subsidyRecordsCopy.title} />
      <Page.Body px="$5" pt="$2">
        {list}
      </Page.Body>
      <Page.Footer>
        <YStack py="$3">{pagerRow}</YStack>
      </Page.Footer>
    </Page>
  );
}

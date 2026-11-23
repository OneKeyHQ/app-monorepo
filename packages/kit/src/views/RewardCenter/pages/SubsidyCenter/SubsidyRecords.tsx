import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
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
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
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

import type { ISubsidyRecordRow } from './subsidyRecordUtils';
import type { ISubsidyHistoryView, ISubsidyQuery } from './useSubsidyRecords';
import type { LayoutChangeEvent } from 'react-native';

export const subsidyRecordsCopy = {
  title: ETranslations.subsidy_records__title,
  empty: ETranslations.subsidy_records_empty__msg,
  loadFailed: ETranslations.subsidy_records_failed__msg,
  partial: ETranslations.subsidy_records_partial__msg,
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
  items: ISubsidyRecordRow[];
  rowHeight?: number;
}) {
  const intl = useIntl();
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
            <NetworkAvatar networkId={record.networkId} size="$8" />
          </Stack>
          <YStack flex={1} minWidth={0} gap="$0.5">
            <SizableText size="$headingSm" numberOfLines={1}>
              {intl.formatMessage({ id: record.titleId })}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {formatDate(record.createdAt, { hideTimeForever: true })}
            </SizableText>
          </YStack>
          {record.amountUsd ? (
            <NumberSizeableText
              size="$bodyMdMedium"
              color="$textSuccess"
              flexShrink={0}
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              {record.amountUsd}
            </NumberSizeableText>
          ) : (
            <SizableText
              size="$bodyMdMedium"
              color="$textSubdued"
              flexShrink={0}
            >
              {record.statusId
                ? intl.formatMessage({ id: record.statusId })
                : '—'}
            </SizableText>
          )}
        </XStack>
      ))}
    </YStack>
  );
}

// Keep the overview row, loading placeholder and empty state at the same
// minimum height so resolving records does not shift the surrounding content.
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
          <YStack flex={1} gap="$0.5">
            <Skeleton.HeadingSm />
            <Skeleton.BodySm />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

// Why the records on screen are not the whole, current answer.
type ISubsidyRecordsIssue = {
  message: ETranslations;
  testID: string;
};

// The records on screen come from an earlier request and the refresh after
// it failed: a record added since (a claim) is missing, so an empty list is
// not "no records". This outranks a partial result, which describes that
// earlier response. Otherwise a source failed and records may be missing.
// Either way what did load stays on screen and the retry asks again.
function getSubsidyRecordsIssue(
  query: ISubsidyQuery<ISubsidyHistoryView>,
): ISubsidyRecordsIssue | undefined {
  if (query.isRefreshError) {
    return {
      message: subsidyRecordsCopy.loadFailed,
      testID: 'subsidy-records-stale',
    };
  }
  if (query.data?.isPartial) {
    return {
      message: subsidyRecordsCopy.partial,
      testID: 'subsidy-records-partial',
    };
  }
  return undefined;
}

// Layout height of the tertiary retry button of `SubsidyRecordsNotice`: a
// 20px label and 4px paddings inside a 1px border, less its -5px margins.
const recordsNoticeHeight = 20;

// One row that names the issue next to the records that did load.
function SubsidyRecordsNotice({
  issue,
  onRetry,
  isRetrying,
  size = '$bodySm',
}: {
  issue: ISubsidyRecordsIssue;
  onRetry: () => void;
  isRetrying: boolean;
  size?: '$bodySm' | '$bodyMd';
}) {
  const intl = useIntl();
  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      gap="$3"
      testID={issue.testID}
    >
      <SizableText
        size={size}
        color="$textSubdued"
        flexShrink={1}
        numberOfLines={1}
      >
        {intl.formatMessage({ id: issue.message })}
      </SizableText>
      <Button
        size="small"
        variant="tertiary"
        flexShrink={0}
        loading={isRetrying}
        onPress={onRetry}
        testID={`${issue.testID}-retry`}
      >
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </XStack>
  );
}

// `isRetrying` is for a state that stays on screen while its retry is in
// flight: the button shows the request and takes no second press.
function SubsidyLoadFailed({
  message,
  onRetry,
  isRetrying = false,
  testID,
}: {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
  testID: string;
}) {
  const intl = useIntl();
  return (
    <YStack alignItems="center" gap="$3" py="$2" testID={testID}>
      <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
        {message}
      </SizableText>
      <Button
        size="small"
        loading={isRetrying}
        onPress={onRetry}
        testID={`${testID}-retry`}
      >
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
  const message = intl.formatMessage({
    id: ETranslations.subsidy_summary_failed__msg,
  });
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
  const intl = useIntl();
  const { data, isLoading, isError, isFetching, reload } = query;
  const issue = getSubsidyRecordsIssue(query);
  let content;
  if (isError) {
    content = (
      <SubsidyLoadFailed
        message={intl.formatMessage({ id: subsidyRecordsCopy.loadFailed })}
        onRetry={reload}
        testID="subsidy-records-error"
      />
    );
  } else if (isLoading || !data) {
    content = <SubsidyRecordSkeleton rows={1} />;
  } else if (data.items.length === 0) {
    // An incomplete or outdated result is not "no records": say what
    // happened instead.
    content = (
      <YStack minHeight={recentRecordRowHeight} justifyContent="center">
        {issue ? (
          <SubsidyRecordsNotice
            issue={issue}
            size="$bodyMd"
            onRetry={reload}
            isRetrying={isFetching}
          />
        ) : (
          <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
            {intl.formatMessage({ id: subsidyRecordsCopy.empty })}
          </SizableText>
        )}
      </YStack>
    );
  } else {
    content = (
      <>
        <SubsidyRecordList
          items={data.items.slice(0, SUBSIDY_RECENT_RECORD_LIMIT)}
        />
        {issue ? (
          <SubsidyRecordsNotice
            issue={issue}
            onRetry={reload}
            isRetrying={isFetching}
          />
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
  const intl = useIntl();
  const rowHeight = compact ? 52 : 64;
  const [pageSize, setPageSize] = useState<number>();
  const [page, setPage] = useState(1);
  const query = useSubsidyHistoryPage(identity, { page, pageSize });
  const {
    data,
    isLoading,
    isError,
    isPreviousData,
    isFetching,
    isRefreshError,
    reload,
  } = query;
  const issue = getSubsidyRecordsIssue(query);

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
    isSettled: !isPreviousData && !isLoading && !isFetching && !isRefreshError,
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
          message={intl.formatMessage({ id: subsidyRecordsCopy.loadFailed })}
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
    content = issue ? (
      <YStack flex={1} justifyContent="center">
        <SubsidyLoadFailed
          message={intl.formatMessage({ id: issue.message })}
          onRetry={reload}
          isRetrying={isFetching}
          testID={issue.testID}
        />
      </YStack>
    ) : (
      <Empty
        flex={1}
        {...(compact
          ? {
              illustration: 'Orders',
              title: intl.formatMessage({ id: subsidyRecordsCopy.empty }),
              titleProps: { size: '$headingMd' },
            }
          : {
              illustration: 'Document',
              illustrationProps: { size: 88, mb: '$1' },
              description: intl.formatMessage({ id: subsidyRecordsCopy.empty }),
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
      <YStack flex={1} minHeight={0} onLayout={handleListLayout}>
        {content}
      </YStack>
      {/* The row is as tall as the notice even without it: the list area
          above must not change height when the notice comes and goes,
          because its height decides how many records a page holds. */}
      <XStack alignItems="center" gap="$3" minHeight={recordsNoticeHeight}>
        {issue && data && data.items.length > 0 ? (
          <SubsidyRecordsNotice
            issue={issue}
            onRetry={reload}
            isRetrying={isFetching}
          />
        ) : null}
      </XStack>
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
      <Page.Header
        title={intl.formatMessage({ id: subsidyRecordsCopy.title })}
      />
      <Page.Body px="$5" pt="$2">
        {list}
      </Page.Body>
      <Page.Footer>
        <YStack py="$3">{pagerRow}</YStack>
      </Page.Footer>
    </Page>
  );
}

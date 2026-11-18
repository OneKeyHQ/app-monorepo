import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  Icon,
  NumberSizeableText,
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
  SUBSIDY_HISTORY_LIMIT,
  SUBSIDY_RECENT_RECORD_LIMIT,
} from './subsidyRecordUtils';

import type {
  ISubsidyHistoryView,
  ISubsidyQuery,
  ISubsidyRecordListItem,
} from './useSubsidyRecords';

// TODO(OK-67058): move to i18n keys once the copy is final.
export const subsidyRecordsCopy = {
  title: '补贴记录',
  empty: '暂无补贴记录',
  loadFailed: '补贴记录暂时无法加载',
  partial: '部分记录暂时无法加载',
  timeWindow: '最近 90 天',
  truncated: `仅显示最近 ${SUBSIDY_HISTORY_LIMIT} 笔记录`,
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

function SubsidyRecordSkeleton({ rowHeight }: { rowHeight?: number }) {
  return (
    <YStack gap={rowHeight === undefined ? '$6' : undefined}>
      {[0, 1, 2].map((index) => (
        <XStack key={index} minHeight={rowHeight} alignItems="center" gap="$3">
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
    content = <SubsidyRecordSkeleton />;
  } else if (data.items.length === 0) {
    // A partial result is not "no records": say what happened instead.
    content = (
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        textAlign="center"
        py="$2"
      >
        {data.isPartial ? subsidyRecordsCopy.partial : subsidyRecordsCopy.empty}
      </SizableText>
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

// The scrollable record list of the desktop panel (`compact`) and of the
// mobile history page. Pagination is not wired yet: it shows the first page.
export function SubsidyRecordsPanel({
  query,
  compact = false,
}: {
  query: ISubsidyQuery<ISubsidyHistoryView>;
  compact?: boolean;
}) {
  const { data, isLoading, isError, reload } = query;
  const rowHeight = compact ? 52 : 64;
  const isEmpty = !isLoading && !isError && data?.items.length === 0;

  let content;
  if (isError) {
    content = (
      <YStack flexGrow={1} justifyContent="center">
        <SubsidyLoadFailed
          message={subsidyRecordsCopy.loadFailed}
          onRetry={reload}
          testID="subsidy-records-error"
        />
      </YStack>
    );
  } else if (isLoading || !data) {
    content = <SubsidyRecordSkeleton rowHeight={rowHeight} />;
  } else if (data.items.length === 0) {
    content = data.isPartial ? (
      <YStack flexGrow={1} justifyContent="center">
        <SubsidyLoadFailed
          message={subsidyRecordsCopy.partial}
          onRetry={reload}
          testID="subsidy-records-partial"
        />
      </YStack>
    ) : (
      <Empty
        flexGrow={1}
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
      <YStack gap="$3">
        <SizableText size="$bodySm" color="$textSubdued">
          {subsidyRecordsCopy.timeWindow}
        </SizableText>
        <SubsidyRecordList items={data.items} rowHeight={rowHeight} />
        {data.isPartial ? (
          <SubsidyNotice>{subsidyRecordsCopy.partial}</SubsidyNotice>
        ) : null}
        {data.hasMore ? (
          <SubsidyNotice>{subsidyRecordsCopy.truncated}</SubsidyNotice>
        ) : null}
      </YStack>
    );
  }

  return (
    <ScrollView
      flex={1}
      minHeight={0}
      contentContainerStyle={
        isError || isEmpty ? { flexGrow: 1 } : { pb: '$4' }
      }
      testID="subsidy-records-panel"
    >
      {content}
    </ScrollView>
  );
}

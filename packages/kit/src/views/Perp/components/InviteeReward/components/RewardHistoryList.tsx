import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IPerpsInviteeRewardHistoryItem,
  IPerpsInviteeRewardToken,
} from '@onekeyhq/shared/src/referralCode/type';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

const PAGE_SIZE = 10;

interface IRewardHistoryListProps {
  isLoading?: boolean;
  history?: IPerpsInviteeRewardHistoryItem[];
  token?: IPerpsInviteeRewardToken;
}

interface IRewardItemProps {
  item: IPerpsInviteeRewardHistoryItem;
  token: IPerpsInviteeRewardToken;
}

function RewardItemSkeleton() {
  return (
    <YStack gap="$2">
      <Skeleton width={80} height={14} />
      <XStack ai="center" jc="space-between" py="$1">
        <XStack ai="center" gap="$3" flex={1}>
          <Skeleton width={40} height={40} radius="round" />
          <YStack gap="$1" flex={1}>
            <Skeleton width={60} height={16} />
            <Skeleton width={100} height={14} />
          </YStack>
        </XStack>
        <Skeleton width={80} height={16} />
      </XStack>
    </YStack>
  );
}

function RewardItem({ item, token }: IRewardItemProps) {
  const handleTxPress = useCallback(() => {
    if (item.tx) {
      const explorerUrl = `https://arbiscan.io/tx/${item.tx}`;
      openUrlUtils.openUrlExternal(explorerUrl);
    }
  }, [item.tx]);

  return (
    <YStack gap="$2">
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {item.date}
      </SizableText>
      <XStack ai="center" jc="space-between" py="$1">
        <XStack ai="center" gap="$3" flex={1}>
          <Token size="md" tokenImageUri={token.logoURI} />
          <YStack gap="$0.5" flex={1}>
            <SizableText size="$bodyMdMedium">Reward</SizableText>
            {item.tx ? (
              <XStack
                ai="center"
                gap="$1"
                onPress={handleTxPress}
                cursor="pointer"
              >
                <SizableText size="$bodySm" color="$textSubdued">
                  {`${item.tx.slice(0, 8)}...${item.tx.slice(-6)}`}
                </SizableText>
                <Icon name="OpenOutline" size="$4" color="$iconSubdued" />
              </XStack>
            ) : null}
          </YStack>
        </XStack>

        <NumberSizeableText
          color="$textSuccess"
          formatter="value"
          formatterOptions={{
            tokenSymbol: token.symbol,
            showPlusMinusSigns: true,
          }}
        >
          {item.amount}
        </NumberSizeableText>
      </XStack>
    </YStack>
  );
}

export function RewardHistoryList({
  isLoading,
  history,
  token,
}: IRewardHistoryListProps) {
  const intl = useIntl();
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const displayedHistory = useMemo(() => {
    if (!history) return [];
    return history.slice(0, displayCount);
  }, [history, displayCount]);

  const hasMore = useMemo(() => {
    if (!history) return false;
    return displayCount < history.length;
  }, [history, displayCount]);

  const handleShowMore = useCallback(() => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  }, []);

  if (isLoading) {
    return (
      <YStack gap="$5">
        <RewardItemSkeleton />
      </YStack>
    );
  }

  if (!history || history.length === 0 || !token) {
    return (
      <YStack ai="center" jc="center" py="$6">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_no_data,
            defaultMessage: 'No data',
          })}
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack gap="$5" pt="$2">
      {displayedHistory.map((item) => (
        <RewardItem key={item.tx} item={item} token={token} />
      ))}
      {hasMore ? (
        <XStack
          ai="center"
          jc="center"
          gap="$1"
          py="$2"
          onPress={handleShowMore}
          cursor="pointer"
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
        >
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.global_show_more,
              defaultMessage: 'Show More',
            })}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      ) : null}
    </YStack>
  );
}

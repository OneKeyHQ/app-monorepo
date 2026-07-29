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
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapInviteeRewardHistoryItem } from '@onekeyhq/shared/src/referralCode/type';

const PAGE_SIZE = 10;

interface IRewardHistoryListProps {
  isLoading?: boolean;
  history?: ISwapInviteeRewardHistoryItem[];
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

function RewardItem({ item }: { item: ISwapInviteeRewardHistoryItem }) {
  const intl = useIntl();
  const handleTxPress = useCallback(() => {
    void openTransactionDetailsUrl({
      networkId: item.token.networkId,
      txid: item.tx,
    });
  }, [item.token.networkId, item.tx]);

  return (
    <YStack gap="$2">
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {item.date}
      </SizableText>
      <XStack ai="center" jc="space-between" py="$1">
        <XStack ai="center" gap="$3" flex={1}>
          <Token size="md" tokenImageUri={item.token.logoURI} />
          <YStack gap="$0.5" flex={1}>
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({
                id: ETranslations.referral_reward_history_reward_title,
              })}
            </SizableText>
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
            tokenSymbol: item.token.symbol,
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
}: IRewardHistoryListProps) {
  const intl = useIntl();
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const displayedHistory = useMemo(
    () => history?.slice(0, displayCount) ?? [],
    [displayCount, history],
  );
  const hasMore = Boolean(history && displayCount < history.length);
  const handleShowMore = useCallback(() => {
    setDisplayCount((previousCount) => previousCount + PAGE_SIZE);
  }, []);

  if (isLoading) {
    return (
      <YStack gap="$5">
        <RewardItemSkeleton />
      </YStack>
    );
  }

  if (!history?.length) {
    return (
      <YStack ai="center" jc="center" py="$6">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_no_data,
          })}
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack gap="$5" pt="$2">
      {displayedHistory.map((item, index) => (
        <RewardItem key={`${item.date}-${item.tx}-${index}`} item={item} />
      ))}
      {hasMore ? (
        <XStack
          testID="swap-invitee-reward-show-more"
          ai="center"
          jc="center"
          gap="$1"
          py="$2"
          onPress={handleShowMore}
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
          cursor="pointer"
        >
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.global_show_more,
            })}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      ) : null}
    </YStack>
  );
}

import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Button, IconButton, Stack, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IEarnHistoryActionIcon,
  IStakeTag,
} from '@onekeyhq/shared/types/staking';

type IStakingActivityIndicatorProps = {
  num: number;
  onPress?: () => void;
  historyAction?: IEarnHistoryActionIcon;
  shareUrl?: string;
  onShare?: () => void;
};

export const PendingIndicator = ({
  num,
  onPress,
}: Pick<IStakingActivityIndicatorProps, 'num' | 'onPress'>) => {
  const intl = useIntl();
  return (
    <Stack cursor={onPress ? 'pointer' : 'default'}>
      <Badge badgeType="info" badgeSize="lg" onPress={onPress}>
        <Stack borderRadius="$full" p={3} bg="$borderInfo">
          <Stack w="$1.5" h="$1.5" borderRadius="$full" bg="$iconInfo" />
        </Stack>
        <Badge.Text pl="$2">
          {num > 1
            ? `${num} ${intl.formatMessage({
                id: ETranslations.global_pending,
              })} `
            : intl.formatMessage({ id: ETranslations.global_pending })}
        </Badge.Text>
      </Badge>
    </Stack>
  );
};

export const useStakingPendingTxs = ({
  accountId,
  networkId,
  stakeTag,
  onRefresh,
}: {
  accountId?: string;
  networkId: string;
  stakeTag?: IStakeTag;
  onRefresh?: () => void;
}) => {
  const { result: pollingInterval } = usePromiseResult(
    async () => {
      const time =
        await backgroundApiProxy.serviceStaking.getFetchHistoryPollingInterval({
          networkId,
        });
      return timerUtils.getTimeDurationMs({ seconds: time });
    },
    [networkId],
    { initResult: timerUtils.getTimeDurationMs({ seconds: 30 }) },
  );

  const { result: txs, run: refreshPendingTxs } = usePromiseResult(
    async () => {
      if (!accountId || !stakeTag) {
        return [];
      }
      return backgroundApiProxy.serviceStaking.fetchLocalStakingHistory({
        accountId,
        networkId,
        stakeTag,
      });
    },
    [accountId, networkId, stakeTag],
    {
      initResult: [],
      revalidateOnFocus: true,
    },
  );

  const isPending = useMemo(() => txs.length > 0, [txs.length]);
  const prevIsPending = usePrevious(isPending);

  const refreshPendingWithHistory = useCallback(async () => {
    if (!accountId || !stakeTag) {
      return;
    }
    await backgroundApiProxy.serviceHistory.fetchAccountHistory({
      accountId,
      networkId,
    });
    await refreshPendingTxs();
  }, [accountId, networkId, stakeTag, refreshPendingTxs]);

  usePromiseResult(
    async () => {
      if (!isPending || !accountId || !stakeTag) {
        return;
      }

      await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId,
        networkId,
      });

      await refreshPendingTxs();
    },
    [isPending, accountId, networkId, stakeTag, refreshPendingTxs],
    {
      pollingInterval,
    },
  );

  useEffect(() => {
    if (!isPending && prevIsPending) {
      onRefresh?.();
    }
  }, [isPending, prevIsPending, onRefresh]);

  return {
    pendingCount: txs.length,
    refreshPending: refreshPendingWithHistory,
  };
};

const StakingActivityIndicator = ({
  num,
  onPress,
  historyAction,
  shareUrl,
  onShare,
}: IStakingActivityIndicatorProps) => {
  const appNavigation = useAppNavigation();
  const headerRight = useCallback(() => {
    if (num > 0) {
      return (
        <XStack gap="$4" alignItems="center">
          <PendingIndicator num={num} onPress={onPress} />
          {shareUrl && onShare ? (
            <IconButton
              icon="ShareOutline"
              variant="tertiary"
              size="medium"
              onPress={onShare}
            />
          ) : null}
        </XStack>
      );
    }
    if ((historyAction && onPress) || (shareUrl && onShare)) {
      return (
        <XStack gap="$4" alignItems="center">
          {historyAction && onPress ? (
            <Button
              variant="tertiary"
              size="medium"
              disabled={historyAction.disabled}
              onPress={onPress}
            >
              {historyAction.text.text}
            </Button>
          ) : null}
          {shareUrl && onShare ? (
            <IconButton
              icon="ShareOutline"
              variant="tertiary"
              size="medium"
              onPress={onShare}
            />
          ) : null}
        </XStack>
      );
    }
    return null;
  }, [historyAction, num, onPress, shareUrl, onShare]);
  useEffect(() => {
    appNavigation.setOptions({
      headerRight,
    });
  }, [appNavigation, headerRight, num]);
  return null;
};

export const StakingTransactionIndicator = ({
  accountId,
  networkId,
  stakeTag,
  onRefresh,
  onPress,
  historyAction,
  shareUrl,
  onShare,
}: {
  accountId?: string;
  networkId: string;
  stakeTag: IStakeTag;
  onRefresh?: () => void;
  onPress?: () => void;
  historyAction?: IEarnHistoryActionIcon;
  shareUrl?: string;
  onShare?: () => void;
}) => {
  const { pendingCount } = useStakingPendingTxs({
    accountId,
    networkId,
    stakeTag,
    onRefresh,
  });

  return (
    <StakingActivityIndicator
      num={pendingCount}
      onPress={onPress}
      historyAction={historyAction}
      shareUrl={shareUrl}
      onShare={onShare}
    />
  );
};

import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Button, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
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
};

const PendingIndicator = ({ num, onPress }: IStakingActivityIndicatorProps) => {
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

const StakingActivityIndicator = ({
  num,
  onPress,
  historyAction,
}: IStakingActivityIndicatorProps) => {
  const appNavigation = useAppNavigation();
  const headerRight = useCallback(() => {
    if (num > 0) {
      return <PendingIndicator num={num} onPress={onPress} />;
    }
    if (historyAction && onPress) {
      return (
        <Button
          variant="tertiary"
          size="medium"
          disabled={historyAction.disabled}
          onPress={onPress}
        >
          {historyAction.text.text}
        </Button>
      );
    }
    return null;
  }, [historyAction, num, onPress]);
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
}: {
  accountId?: string;
  networkId: string;
  stakeTag: IStakeTag;
  onRefresh?: () => void;
  onPress?: () => void;
  historyAction?: IEarnHistoryActionIcon;
}) => {
  const { result: txs, run } = usePromiseResult(
    async () => {
      if (!accountId) {
        return [];
      }
      return backgroundApiProxy.serviceStaking.fetchLocalStakingHistory({
        accountId,
        networkId,
        stakeTag,
      });
    },
    [accountId, networkId, stakeTag],
    { initResult: [] },
  );
  const isPending = txs.length > 0;
  const prevIsPending = usePrevious(isPending);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      void run();
    }
  }, [isFocused, run]);

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

  usePromiseResult(
    async () => {
      if (!isPending) {
        return;
      }
      if (accountId) {
        await backgroundApiProxy.serviceHistory.fetchAccountHistory({
          accountId,
          networkId,
        });
      }
      await run();
    },
    [accountId, isPending, networkId, run],
    {
      pollingInterval,
    },
  );

  useEffect(() => {
    if (!isPending && prevIsPending) {
      onRefresh?.();
    }
  }, [prevIsPending, isPending, onRefresh]);

  return (
    <StakingActivityIndicator
      num={txs.length}
      onPress={onPress}
      historyAction={historyAction}
    />
  );
};

import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Badge, IconButton, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IStakeTag } from '@onekeyhq/shared/types/staking';

type IStakingActivityIndicatorProps = {
  num: number;
  onPress?: () => void;
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
}: IStakingActivityIndicatorProps) => {
  const appNavigation = useAppNavigation();
  const headerRight = useCallback(() => {
    if (num > 0) {
      return <PendingIndicator num={num} onPress={onPress} />;
    }
    if (onPress) {
      return (
        <IconButton
          variant="tertiary"
          size="medium"
          icon="ClockTimeHistoryOutline"
          onPress={onPress}
        />
      );
    }
    return null;
  }, [num, onPress]);
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
}: {
  accountId?: string;
  networkId: string;
  stakeTag: IStakeTag;
  onRefresh?: () => void;
  onPress?: () => void;
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
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 50 }),
    },
  );

  useEffect(() => {
    if (!isPending && prevIsPending) {
      onRefresh?.();
    }
  }, [prevIsPending, isPending, onRefresh]);

  return <StakingActivityIndicator num={txs.length} onPress={onPress} />;
};

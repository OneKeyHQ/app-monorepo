import { useEffect } from 'react';

import { Alert, Dialog, YStack } from '@onekeyhq/components';
import type { IYStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETabEarnRoutes } from '@onekeyhq/shared/src/routes';
import type { IPoolTask } from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import { emitPoolsDataChanged, onPoolsDataChanged } from '../poolsDemoEvents';

/** Abandoning keeps assets where they are; nothing is swapped back (doc §3.8) */
export function confirmAbandonPoolTask(task: IPoolTask, onDone?: () => void) {
  Dialog.show({
    title: POOLS_COPY.abandonTitle,
    description: POOLS_COPY.abandonBody,
    onConfirmText: POOLS_COPY.abandon,
    confirmButtonProps: { variant: 'destructive' },
    onCancelText: POOLS_COPY.cancel,
    onConfirm: async () => {
      await backgroundApiProxy.servicePools.abandonTask({ taskId: task.id });
      emitPoolsDataChanged();
      onDone?.();
    },
  });
}

/**
 * Tasks that stopped after moving assets. Shown where the user would start
 * the same thing again, so they continue it instead of starting over.
 */
export function PoolUnfinishedTasks({
  poolId,
  positionId,
  ...rest
}: {
  poolId?: string;
  positionId?: string;
} & Omit<IYStackProps, 'children'>) {
  const navigation = useAppNavigation();
  const { result: tasks, run } = usePromiseResult(
    async () => (await backgroundApiProxy.servicePools.getPortfolio()).tasks,
    [],
    { revalidateOnFocus: true },
  );
  useEffect(() => onPoolsDataChanged(() => void run()), [run]);
  const matching = (tasks ?? []).filter(
    (task) =>
      (!poolId || task.poolIds.includes(poolId)) &&
      (!positionId || task.positionIds.includes(positionId)),
  );
  if (!matching.length) {
    return null;
  }
  return (
    <YStack gap="$3" {...rest}>
      {matching.map((task) => (
        <Alert
          key={task.id}
          type="warning"
          title={POOLS_COPY.unfinishedTitle(POOLS_COPY.taskTitle[task.kind])}
          description={POOLS_COPY.unfinishedBody}
          action={{
            primary: POOLS_COPY.continue,
            onPrimaryPress: () =>
              navigation.push(ETabEarnRoutes.EarnPoolTask, {
                taskId: task.id,
              }),
            primaryTestID: `earn-pool-task-continue-${task.id}`,
            secondary: POOLS_COPY.abandon,
            onSecondaryPress: () => confirmAbandonPoolTask(task),
            secondaryTestID: `earn-pool-task-abandon-${task.id}`,
          }}
        />
      ))}
    </YStack>
  );
}

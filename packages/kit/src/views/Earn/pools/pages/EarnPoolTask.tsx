import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';

import {
  Alert,
  Button,
  Dialog,
  Icon,
  Page,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabEarnParamList } from '@onekeyhq/shared/src/routes';
import { isTickInRange } from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPoolsAprEstimate } from '@onekeyhq/shared/src/utils/poolsMath';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  EPoolTaskKind,
  EPoolTaskStatus,
  EPoolTaskStepKind,
  EPoolTaskStepStatus,
} from '@onekeyhq/shared/types/pools';
import type {
  IPool,
  IPoolTask,
  IPoolTaskAprPreview,
  IPoolTaskStep,
  IPoolTaskTokenAmount,
} from '@onekeyhq/shared/types/pools';

import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { describeAprEstimate } from '../components/PoolAprEstimate';
import { PoolPairIcon } from '../components/PoolPairIcon';
import { PoolPositionStatus } from '../components/PoolPositionCard';
import { PoolsCard } from '../components/PoolsCard';
import { PoolsDemoMenuButton } from '../components/PoolsDemoMenuButton';
import { PoolsFlowColumn } from '../components/PoolsFlowColumn';
import { PoolTags } from '../components/PoolTags';
import { POOLS_COPY } from '../poolsCopy';
import { emitPoolsDataChanged } from '../poolsDemoEvents';
import {
  formatFeeTier,
  formatTokenAmount,
  formatUsd,
  getPoolPairTitle,
  getPoolVersionLabel,
  getRangeLine,
  sortByPair,
} from '../poolsFormat';
import { isCostlySwap } from '../poolsOutcome';
import { usePoolsBreadcrumb } from '../usePoolsBreadcrumb';

import type { RouteProp } from '@react-navigation/core';

/** Abandoning keeps assets where they are; nothing is swapped back (doc §3.8) */
function confirmAbandonPoolTask(task: IPoolTask, onDone?: () => void) {
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

// A wallet confirmation plus the block it lands in, roughly
const SECONDS_PER_STEP = 20;

function formatAmount(item: IPoolTaskTokenAmount) {
  return formatTokenAmount(item.amount, item.symbol);
}

function nonZero(items: Array<IPoolTaskTokenAmount | undefined>) {
  return items.filter(
    (item): item is IPoolTaskTokenAmount =>
      Boolean(item) && new BigNumber(item?.amount ?? 0).gt(0),
  );
}

/** ETH to WETH is a wrap, not a market swap */
function isWrap(step: IPoolTaskStep) {
  const from = step.tokenIn?.symbol ?? '';
  const to = step.tokenOut?.symbol ?? '';
  return to === `W${from}` || from === `W${to}`;
}

function getPoolName(pool: IPool) {
  const fee = pool.isDynamicFee
    ? POOLS_COPY.dynamicFee
    : formatFeeTier(pool.feeTier);
  return `${getPoolPairTitle(pool)} ${getPoolVersionLabel(pool)} ${fee}`;
}

function getStepTitle(step: IPoolTaskStep) {
  const from = step.tokenIn?.symbol ?? '';
  const to = step.tokenOut?.symbol ?? '';
  switch (step.kind) {
    case EPoolTaskStepKind.Approve:
    case EPoolTaskStepKind.ApprovePermit2:
      return POOLS_COPY.stepAllow(
        step.spenderLabel ?? step.spenderName ?? '',
        from,
      );
    case EPoolTaskStepKind.SignPermit:
      return POOLS_COPY.stepSignPermit;
    case EPoolTaskStepKind.Swap:
      return isWrap(step)
        ? POOLS_COPY.stepWrap(from, to)
        : POOLS_COPY.stepSwap(from, to);
    case EPoolTaskStepKind.AddLiquidity:
      return POOLS_COPY.stepAdd;
    case EPoolTaskStepKind.IncreaseLiquidity:
      return POOLS_COPY.stepIncrease;
    case EPoolTaskStepKind.RemoveLiquidity:
      return POOLS_COPY.stepRemove;
    case EPoolTaskStepKind.CollectFees:
      return POOLS_COPY.stepCollect;
    default:
      return '';
  }
}

/**
 * What the step moves, one line each: estimates before it lands, actual
 * amounts after
 */
function getStepDetail(
  step: IPoolTaskStep,
  poolsById: Map<string, IPool>,
): string[] {
  const stepPool = step.poolId ? poolsById.get(step.poolId) : undefined;
  // With one pool the page header already names it
  const poolLine =
    stepPool && poolsById.size > 1 ? [getPoolName(stepPool)] : [];
  const inPairOrder = (items: IPoolTaskTokenAmount[]) =>
    sortByPair(stepPool, items, (item) => item.assetId);
  switch (step.kind) {
    case EPoolTaskStepKind.Approve:
    case EPoolTaskStepKind.ApprovePermit2:
    case EPoolTaskStepKind.SignPermit:
      // The title says it; the contract shows in the wallet
      return [];
    case EPoolTaskStepKind.Swap: {
      const out = step.received?.[0] ?? step.tokenOut;
      return step.tokenIn && out
        ? [`${formatAmount(step.tokenIn)} → ${formatAmount(out)}`]
        : [];
    }
    case EPoolTaskStepKind.AddLiquidity:
    case EPoolTaskStepKind.IncreaseLiquidity: {
      const amounts = nonZero(step.spent ?? [step.tokenIn, step.tokenOut]);
      return [...poolLine, ...inPairOrder(amounts).map(formatAmount)];
    }
    case EPoolTaskStepKind.RemoveLiquidity:
    case EPoolTaskStepKind.CollectFees:
      return [
        ...poolLine,
        ...inPairOrder(nonZero(step.received ?? [])).map(formatAmount),
      ];
    default:
      return [];
  }
}

/** The wallet sheet also names the contract an approval is for */
function getWalletLines(step: IPoolTaskStep, poolsById: Map<string, IPool>) {
  const contract = step.spenderName
    ? [POOLS_COPY.stepContract(step.spenderName)]
    : [];
  return [...contract, ...getStepDetail(step, poolsById)];
}

function DetailLines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line) => (
        <SizableText key={line} size="$bodyMd" color="$textSubdued">
          {line}
        </SizableText>
      ))}
    </>
  );
}

function StepIndicator({
  step,
  index,
  isConfirming,
}: {
  step: IPoolTaskStep;
  index: number;
  isConfirming: boolean;
}) {
  if (step.status === EPoolTaskStepStatus.Done) {
    return <Icon name="CheckRadioSolid" color="$iconSuccess" size="$6" />;
  }
  if (step.status === EPoolTaskStepStatus.Failed) {
    return <Icon name="XCircleSolid" color="$iconCritical" size="$6" />;
  }
  if (step.status === EPoolTaskStepStatus.Submitted || isConfirming) {
    return (
      <Stack w="$6" h="$6" ai="center" jc="center">
        <Spinner size="small" />
      </Stack>
    );
  }
  return (
    <Stack
      w="$6"
      h="$6"
      borderRadius="$full"
      bg="$bgStrong"
      ai="center"
      jc="center"
    >
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {index + 1}
      </SizableText>
    </Stack>
  );
}

function StepRow({
  step,
  index,
  poolsById,
  isConfirming,
}: {
  step: IPoolTaskStep;
  index: number;
  poolsById: Map<string, IPool>;
  isConfirming: boolean;
}) {
  const lines = getStepDetail(step, poolsById);
  let status: string | undefined;
  if (isConfirming) {
    status = POOLS_COPY.statusConfirming;
  } else if (step.status === EPoolTaskStepStatus.Submitted) {
    status = POOLS_COPY.statusSubmitted;
  }
  return (
    <XStack gap="$3" ai="flex-start" testID={`earn-pool-task-step-${index}`}>
      <StepIndicator step={step} index={index} isConfirming={isConfirming} />
      <YStack flex={1} gap="$0.5">
        <XStack jc="space-between" gap="$2">
          <SizableText size="$bodyLgMedium" flexShrink={1}>
            {getStepTitle(step)}
          </SizableText>
          {status ? (
            <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
              {status}
            </SizableText>
          ) : null}
        </XStack>
        <DetailLines lines={lines} />
        {step.status === EPoolTaskStepStatus.Failed && step.error ? (
          <SizableText size="$bodyMd" color="$textCritical">
            {step.error}
          </SizableText>
        ) : null}
      </YStack>
    </XStack>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <XStack jc="space-between" ai="flex-start" gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <YStack ai="flex-end" gap="$0.5" flexShrink={1}>
        {children}
      </YStack>
    </XStack>
  );
}

function AmountLines({ items }: { items: IPoolTaskTokenAmount[] }) {
  return (
    <>
      {items.map((item) => (
        <SizableText key={item.assetId} size="$bodyMdMedium" textAlign="right">
          {formatAmount(item)}
        </SizableText>
      ))}
    </>
  );
}

/** The add's estimate in the form's terms, so the review reads the same */
function toAprEstimate(apr: IPoolTaskAprPreview): IPoolsAprEstimate {
  return apr.status === 'ok'
    ? { status: 'ok', apr: new BigNumber(apr.apr), isSmallAmount: false }
    : { status: apr.status };
}

/** Where the deposit goes; a range that starts outside the price says so */
function RangeSummaryRow({
  pool,
  range,
  isDone,
}: {
  pool: IPool;
  range: { tickLower: number; tickUpper: number };
  isDone: boolean;
}) {
  const line = getRangeLine(pool, range);
  // Once done, the hero shows the position's status
  const startsOutside =
    !isDone && !isTickInRange({ ...range, tick: pool.currentTick ?? 0 });
  return (
    <SummaryRow label={POOLS_COPY.priceRange}>
      <SizableText size="$bodyMdMedium" textAlign="right">
        {line.text}
      </SizableText>
      {line.unit ? (
        <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
          {line.unit}
        </SizableText>
      ) : null}
      {startsOutside ? (
        <SizableText size="$bodySm" color="$textCaution" textAlign="right">
          {POOLS_COPY.outOfRangeNow}
        </SizableText>
      ) : null}
    </SummaryRow>
  );
}

function AprSummaryRow({
  pool,
  apr,
}: {
  pool: IPool;
  apr: IPoolTaskAprPreview;
}) {
  const info = describeAprEstimate(toAprEstimate(apr), pool);
  return (
    <SummaryRow label={POOLS_COPY.estimatedApr}>
      <SizableText size="$bodyMdMedium" color={info.color}>
        {info.value}
      </SizableText>
      {info.notes.map((note) => (
        <SizableText
          key={note}
          size="$bodySm"
          color="$textSubdued"
          textAlign="right"
        >
          {note}
        </SizableText>
      ))}
    </SummaryRow>
  );
}

/**
 * What the user agrees to: what they pay or receive and, for an add, the
 * range and what it should earn. The split shows in the steps below.
 */
function TaskSummary({ task, pool }: { task: IPoolTask; pool?: IPool }) {
  const { preview } = task;
  const isDone = task.status === EPoolTaskStatus.Done;
  // One pool: both tokens listed the way the pair reads
  const list = (items: IPoolTaskTokenAmount[]) =>
    sortByPair(pool, nonZero(items), (item) => item.assetId);
  const pay = list(preview.pay);
  const receive = list(preview.receive);
  const cost = new BigNumber(preview.costUsd);
  // Only a costly swap gets a row, and only while it can still be avoided
  const isCostly = !isDone && isCostlySwap(cost, preview.valueUsd);
  return (
    <PoolsCard>
      {pay.length ? (
        <SummaryRow label={isDone ? POOLS_COPY.paid : POOLS_COPY.pay}>
          <AmountLines items={pay} />
        </SummaryRow>
      ) : null}
      {receive.length ? (
        <SummaryRow
          label={isDone ? POOLS_COPY.received : POOLS_COPY.youReceive}
        >
          <AmountLines items={receive} />
        </SummaryRow>
      ) : null}
      {pool && preview.range ? (
        <RangeSummaryRow pool={pool} range={preview.range} isDone={isDone} />
      ) : null}
      {pool && preview.apr ? (
        <AprSummaryRow pool={pool} apr={preview.apr} />
      ) : null}
      {isCostly ? (
        <SummaryRow label={POOLS_COPY.swapCost}>
          <SizableText
            testID="earn-pool-task-swap-cost"
            size="$bodyMdMedium"
            color="$textCaution"
          >
            {formatUsd(cost)}
          </SizableText>
        </SummaryRow>
      ) : null}
    </PoolsCard>
  );
}

/** Stands in for the wallet's confirmation sheet */
function confirmInDemoWallet({
  step,
  index,
  total,
  lines,
}: {
  step: IPoolTaskStep;
  index: number;
  total: number;
  lines: string[];
}) {
  return new Promise<boolean>((resolve) => {
    Dialog.show({
      icon: 'WalletOutline',
      title: getStepTitle(step),
      description: POOLS_COPY.stepOf(index + 1, total),
      renderContent: (
        <YStack gap="$3">
          {lines.length ? (
            <YStack gap="$1">
              {lines.map((line) => (
                <SizableText key={line} size="$bodyLgMedium">
                  {line}
                </SizableText>
              ))}
            </YStack>
          ) : null}
          <SizableText size="$bodySm" color="$textSubdued">
            {POOLS_COPY.demoWalletNote}
          </SizableText>
        </YStack>
      ),
      onConfirmText: POOLS_COPY.confirm,
      onCancelText: POOLS_COPY.cancel,
      confirmButtonProps: { testID: 'earn-pool-wallet-confirm' },
      onConfirm: () => resolve(true),
      onClose: async () => resolve(false),
    });
  });
}

/**
 * The outcome first: the pool, what moved and, for a new position, whether
 * it is earning
 */
function TaskDoneHero({ task, pools }: { task: IPoolTask; pools: IPool[] }) {
  const singlePool = pools.length === 1 ? pools[0] : undefined;
  const isAdd =
    task.kind === EPoolTaskKind.AddLiquidity ||
    task.kind === EPoolTaskKind.IncreaseLiquidity ||
    task.kind === EPoolTaskKind.ZapIn;
  const { result: positionView } = usePromiseResult(async () => {
    if (!isAdd || !task.resultPositionId) {
      return undefined;
    }
    const portfolio = await backgroundApiProxy.servicePools.getPortfolio();
    return portfolio.positions.find(
      (view) => view.position.id === task.resultPositionId,
    );
  }, [isAdd, task.resultPositionId]);
  let caption: string;
  if (!singlePool) {
    caption = POOLS_COPY.heroFromPositions(task.positionIds.length);
  } else if (isAdd) {
    caption = POOLS_COPY.heroIn(getPoolPairTitle(singlePool));
  } else {
    caption = POOLS_COPY.heroFrom(getPoolPairTitle(singlePool));
  }
  return (
    <YStack ai="center" gap="$4" py="$4" testID="earn-pool-task-done-hero">
      {singlePool ? (
        <PoolPairIcon pool={singlePool} size="xl" />
      ) : (
        <Icon name="CheckRadioSolid" color="$iconSuccess" size="$12" />
      )}
      <YStack ai="center" gap="$1">
        <SizableText size="$bodyLgMedium" color="$textSubdued">
          {POOLS_COPY.taskDoneTitle[task.kind]}
        </SizableText>
        <SizableText size="$heading4xl" textAlign="center">
          {formatUsd(task.preview.valueUsd)}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
          {caption}
        </SizableText>
      </YStack>
      {positionView ? <PoolPositionStatus view={positionView} /> : null}
    </YStack>
  );
}

function TaskSkeleton() {
  return (
    <PoolsFlowColumn maxWidth={560}>
      <Skeleton w="$48" h="$8" />
      <Skeleton w="100%" h={140} borderRadius="$4" />
      <Skeleton w="100%" h={220} borderRadius="$4" />
    </PoolsFlowColumn>
  );
}

function TaskView({
  initialTask,
  pools,
}: {
  initialTask: IPoolTask;
  pools: IPool[];
}) {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const tabBarHeight = useScrollContentTabBarOffset();
  const [task, setTask] = useState(initialTask);
  const [confirmingStepId, setConfirmingStepId] = useState<string>();
  const [showDoneSteps, setShowDoneSteps] = useState(false);
  const poolsById = useMemo(
    () => new Map(pools.map((pool) => [pool.id, pool])),
    [pools],
  );

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<unknown> | undefined>(undefined);
  const busyRef = useRef(false);

  // Leaving between steps stops the task, so it can be continued later
  useEffect(() => {
    mountedRef.current = true;
    const taskId = initialTask.id;
    return () => {
      mountedRef.current = false;
      void (inFlightRef.current ?? Promise.resolve()).finally(() =>
        backgroundApiProxy.servicePools.stopTask({ taskId }),
      );
    };
  }, [initialTask.id]);

  const runSteps = useCallback(async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    try {
      let current = await backgroundApiProxy.servicePools.getTask({
        taskId: initialTask.id,
      });
      // One wallet confirmation per step; the next one opens on its own
      while (
        mountedRef.current &&
        current.status !== EPoolTaskStatus.Done &&
        current.status !== EPoolTaskStatus.Abandoned
      ) {
        const index = current.steps.findIndex(
          (item) => item.status !== EPoolTaskStepStatus.Done,
        );
        const step = current.steps[index];
        if (!step) {
          break;
        }
        setConfirmingStepId(step.id);
        const confirmed = await confirmInDemoWallet({
          step,
          index,
          total: current.steps.length,
          lines: getWalletLines(step, poolsById),
        });
        setConfirmingStepId(undefined);
        if (!confirmed || !mountedRef.current) {
          break;
        }
        const stepId = step.id;
        setTask({
          ...current,
          status: EPoolTaskStatus.Running,
          steps: current.steps.map((item) =>
            item.id === stepId
              ? {
                  ...item,
                  status: EPoolTaskStepStatus.Submitted,
                  error: undefined,
                }
              : item,
          ),
        });
        const request = backgroundApiProxy.servicePools.runTaskStep({
          taskId: current.id,
        });
        inFlightRef.current = request;
        current = await request;
        inFlightRef.current = undefined;
        if (mountedRef.current) {
          setTask(current);
        }
        if (current.status === EPoolTaskStatus.Stopped) {
          break;
        }
      }
    } finally {
      busyRef.current = false;
      setConfirmingStepId(undefined);
    }
  }, [initialTask.id, poolsById]);

  const isDone = task.status === EPoolTaskStatus.Done;
  const isAbandoned = task.status === EPoolTaskStatus.Abandoned;
  const isRunning = Boolean(
    confirmingStepId ||
    task.steps.some((step) => step.status === EPoolTaskStepStatus.Submitted),
  );
  const hasStarted = task.steps.some(
    (step) => step.status !== EPoolTaskStepStatus.Pending,
  );
  const failedStep = task.steps.find(
    (step) => step.status === EPoolTaskStepStatus.Failed,
  );
  const isIncrease =
    task.request.kind === 'add' && Boolean(task.request.params.positionId);
  const resultPositionId = task.resultPositionId;

  const leave = () => navigation.pop();
  const viewPosition = () => {
    if (resultPositionId) {
      navigation.replace(ETabEarnRoutes.EarnPoolPosition, {
        positionId: resultPositionId,
      });
    }
  };
  const abandon = () =>
    confirmAbandonPoolTask(task, () => {
      void backgroundApiProxy.servicePools
        .getTask({ taskId: task.id })
        .then(setTask);
    });

  let primary: { label: string; onPress: () => void; testID: string };
  let secondary:
    | { label: string; onPress: () => void; testID: string }
    | undefined;
  if (isDone && resultPositionId && !isIncrease) {
    primary = {
      label: POOLS_COPY.viewPosition,
      onPress: viewPosition,
      testID: 'earn-pool-task-view',
    };
    secondary = {
      label: POOLS_COPY.done,
      onPress: leave,
      testID: 'earn-pool-task-done',
    };
  } else if (isDone || isAbandoned) {
    primary = {
      label: POOLS_COPY.done,
      onPress: leave,
      testID: 'earn-pool-task-done',
    };
  } else {
    let label: string = POOLS_COPY.confirmInWallet;
    if (failedStep) {
      label = POOLS_COPY.retry;
    } else if (task.status === EPoolTaskStatus.Stopped && hasStarted) {
      label = POOLS_COPY.continue;
    }
    primary = {
      label,
      onPress: () => void runSteps(),
      testID: 'earn-pool-task-run',
    };
    if (hasStarted && !isRunning) {
      secondary = {
        label: POOLS_COPY.abandon,
        onPress: abandon,
        testID: 'earn-pool-task-abandon',
      };
    }
  }

  const singlePool = pools.length === 1 ? pools[0] : undefined;
  const breadcrumbProps = usePoolsBreadcrumb([
    ...(singlePool
      ? [
          {
            label: getPoolPairTitle(singlePool),
            onClick: () =>
              navigation.navigate(ETabEarnRoutes.EarnPoolDetails, {
                poolId: singlePool.id,
              }),
          },
        ]
      : []),
    { label: POOLS_COPY.taskTitle[task.kind] },
  ]);
  let header: ReactNode = null;
  if (isDone) {
    header = <TaskDoneHero task={task} pools={pools} />;
  } else if (!singlePool) {
    // Several pools: no pool header, so the task names the page
    header = gtMd ? (
      <SizableText size="$heading2xl">
        {POOLS_COPY.taskTitle[task.kind]}
      </SizableText>
    ) : null;
  } else {
    header = (
      <XStack ai="center" gap="$3">
        <PoolPairIcon pool={singlePool} size="md" />
        <YStack gap="$1" flex={1}>
          <SizableText size="$headingLg">
            {getPoolPairTitle(singlePool)}
          </SizableText>
          <PoolTags pool={singlePool} />
        </YStack>
      </XStack>
    );
  }

  const notice = (() => {
    if (isAbandoned) {
      return (
        <Alert
          type="default"
          title={POOLS_COPY.abandoned}
          description={POOLS_COPY.abandonBody}
        />
      );
    }
    return null;
  })();

  const remainingSteps = task.steps.filter(
    (step) => step.status !== EPoolTaskStepStatus.Done,
  ).length;
  const stepList = (
    <YStack gap="$4">
      {task.steps.map((step, index) => (
        <StepRow
          key={step.id}
          step={step}
          index={index}
          poolsById={poolsById}
          isConfirming={confirmingStepId === step.id}
        />
      ))}
    </YStack>
  );

  const buttons = (
    <XStack gap="$3">
      {secondary ? (
        <Button
          flex={1}
          size="large"
          onPress={secondary.onPress}
          testID={secondary.testID}
        >
          {secondary.label}
        </Button>
      ) : null}
      <Button
        flex={1}
        size="large"
        variant="primary"
        loading={isRunning && !isDone}
        disabled={isRunning && !isDone}
        onPress={primary.onPress}
        testID={primary.testID}
      >
        {primary.label}
      </Button>
    </XStack>
  );

  const footer = gtMd ? null : (
    <Page.Footer
      onConfirmText={primary.label}
      confirmButtonProps={{
        variant: 'primary',
        loading: isRunning && !isDone,
        disabled: isRunning && !isDone,
        onPress: primary.onPress,
        testID: primary.testID,
        // Both buttons carry the offset, as on the protocol page; one alone
        // stretches the other to the row's height
        mb: tabBarHeight,
      }}
      {...(secondary
        ? {
            onCancelText: secondary.label,
            cancelButtonProps: {
              onPress: secondary.onPress,
              testID: secondary.testID,
              mb: tabBarHeight,
            },
          }
        : {})}
    />
  );

  return (
    <EarnPageContainer
      pageTitle={
        <SizableText size="$headingLg">
          {POOLS_COPY.taskTitle[task.kind]}
        </SizableText>
      }
      breadcrumbProps={gtMd ? undefined : breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      footer={footer}
      customHeaderRightItems={<PoolsDemoMenuButton />}
      contentContainerStyle={{ pb: gtMd ? '$10' : '$24' }}
    >
      <PoolsFlowColumn breadcrumbProps={breadcrumbProps} maxWidth={560}>
        {header}
        {notice}
        <TaskSummary task={task} pool={singlePool} />
        {/* Once done, the next move matters more than the finished steps */}
        {gtMd && isDone ? buttons : null}
        {isDone ? (
          // Done: the finished list folds into one line, a tap away
          <PoolsCard>
            <XStack
              ai="center"
              gap="$2"
              cursor="pointer"
              userSelect="none"
              onPress={() => setShowDoneSteps((value) => !value)}
              testID="earn-pool-task-steps-toggle"
            >
              <Icon name="CheckRadioSolid" color="$iconSuccess" size="$5" />
              <SizableText size="$bodyLgMedium" flex={1}>
                {POOLS_COPY.stepsCompleted(task.steps.length)}
              </SizableText>
              <Icon
                name={
                  showDoneSteps
                    ? 'ChevronTopSmallOutline'
                    : 'ChevronDownSmallOutline'
                }
                color="$iconSubdued"
                size="$5"
              />
            </XStack>
            {showDoneSteps ? stepList : null}
          </PoolsCard>
        ) : (
          // Desktop has no page header, so the demo controls sit here
          <PoolsCard
            title={POOLS_COPY.steps}
            right={
              gtMd ? (
                <PoolsDemoMenuButton testID="earn-pools-demo-menu-steps" />
              ) : null
            }
          >
            {isAbandoned ? null : (
              <SizableText size="$bodyMd" color="$textSubdued">
                {`${
                  hasStarted
                    ? POOLS_COPY.confirmationsLeft(remainingSteps)
                    : POOLS_COPY.confirmations(remainingSteps)
                }, ${POOLS_COPY.timeEstimate(remainingSteps * SECONDS_PER_STEP)}`}
              </SizableText>
            )}
            {stepList}
          </PoolsCard>
        )}
        {gtMd && !isDone ? buttons : null}
      </PoolsFlowColumn>
    </EarnPageContainer>
  );
}

type IRouteProps = RouteProp<ITabEarnParamList, ETabEarnRoutes.EarnPoolTask>;

function EarnPoolTaskContent({ taskId }: { taskId: string }) {
  const { result } = usePromiseResult(async () => {
    const task = await backgroundApiProxy.servicePools.getTask({ taskId });
    const details = await Promise.all(
      task.poolIds.map((poolId) =>
        backgroundApiProxy.servicePools.getPoolDetail({ poolId }),
      ),
    );
    return { task, pools: details.map((detail) => detail.pool) };
  }, [taskId]);
  if (!result) {
    return (
      <EarnPageContainer
        pageTitle={
          <SizableText size="$headingLg">{POOLS_COPY.steps}</SizableText>
        }
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
        showBackButton
      >
        <TaskSkeleton />
      </EarnPageContainer>
    );
  }
  return <TaskView initialTask={result.task} pools={result.pools} />;
}

export default function EarnPoolTask() {
  const route = useRoute<IRouteProps>();
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home, sceneUrl: '' }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnPoolTaskContent taskId={route.params.taskId} />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

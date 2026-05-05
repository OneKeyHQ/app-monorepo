import { useCallback, useEffect, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Divider,
  IconButton,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAppUpdateInfo,
  IPendingInstallTask,
} from '@onekeyhq/shared/src/appUpdate';
import {
  EAppUpdateStatus,
  EPendingInstallTaskStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import { useDownloadProgress } from '@onekeyhq/shared/src/modules3rdParty/auto-update';

// ---------------------------------------------------------------------------
// Pipeline step types
// ---------------------------------------------------------------------------
type IStepState = 'completed' | 'active' | 'failed' | 'pending';

interface IPipelineStep {
  label: string;
  state: IStepState;
  details?: { label: string; value: string }[];
  /** 0-100, only meaningful for download steps */
  percent?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTs(ts: number | undefined): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

const strategyLabel: Record<EUpdateStrategy, string> = {
  [EUpdateStrategy.silent]: 'Silent',
  [EUpdateStrategy.force]: 'Force',
  [EUpdateStrategy.manual]: 'Manual',
  [EUpdateStrategy.seamless]: 'Seamless',
};

// ---------------------------------------------------------------------------
// Map EAppUpdateStatus → pipeline stages
// ---------------------------------------------------------------------------
// Pipeline order:
//  0 - Check Update
//  1 - Download Package
//  2 - Download Signature
//  3 - Verify Signature
//  4 - Verify Package
//  5 - Ready to Install
//  6 - Done

const UPDATE_PIPELINE_LABELS = [
  'Check Update',
  'Download Package',
  'Download Signature',
  'Verify Signature',
  'Verify Package',
  'Ready to Install',
  'Installed',
];

// Which pipeline index is "active" for each status, and whether it failed
const STATUS_TO_STAGE: Record<
  EAppUpdateStatus,
  { index: number; failed?: boolean }
> = {
  [EAppUpdateStatus.done]: { index: 7 }, // all done, past the pipeline
  [EAppUpdateStatus.notify]: { index: 0 },
  [EAppUpdateStatus.downloadPackage]: { index: 1 },
  [EAppUpdateStatus.downloadPackageFailed]: { index: 1, failed: true },
  [EAppUpdateStatus.downloadASC]: { index: 2 },
  [EAppUpdateStatus.downloadASCFailed]: { index: 2, failed: true },
  [EAppUpdateStatus.verifyASC]: { index: 3 },
  [EAppUpdateStatus.verifyASCFailed]: { index: 3, failed: true },
  [EAppUpdateStatus.verifyPackage]: { index: 4 },
  [EAppUpdateStatus.verifyPackageFailed]: { index: 4, failed: true },
  [EAppUpdateStatus.ready]: { index: 5 },
  [EAppUpdateStatus.failed]: { index: 1, failed: true },
  [EAppUpdateStatus.manualInstall]: { index: 5 },
  [EAppUpdateStatus.updateIncomplete]: { index: 6, failed: true },
};

function buildActiveDetails(
  info: IAppUpdateInfo,
  stageIdx: number,
  isFailed: boolean,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  // Common info for any active step
  rows.push({
    label: 'Strategy',
    value: strategyLabel[info.updateStrategy] ?? String(info.updateStrategy),
  });
  if (info.latestVersion) {
    rows.push({ label: 'Target Version', value: info.latestVersion });
  }
  if (info.jsBundleVersion) {
    rows.push({ label: 'Bundle Version', value: info.jsBundleVersion });
  }

  // Stage-specific details
  if (stageIdx === 0) {
    // Check Update
    rows.push({ label: 'Last Fetched', value: formatTs(info.updateAt) });
    if (info.isRollbackTarget) {
      rows.push({ label: 'Rollback', value: 'Yes' });
    }
  } else if (stageIdx === 1) {
    // Download Package
    const url = info.jsBundle?.downloadUrl ?? info.downloadUrl;
    if (url) rows.push({ label: 'URL', value: url });
    if (info.jsBundle?.fileSize) {
      rows.push({
        label: 'Size',
        value: `${(info.jsBundle.fileSize / 1024 / 1024).toFixed(2)} MB`,
      });
    }
  } else if (stageIdx >= 2 && stageIdx <= 4) {
    // Download/Verify ASC or Verify Package
    if (info.downloadedEvent?.downloadedFile) {
      rows.push({ label: 'File', value: info.downloadedEvent.downloadedFile });
    }
    if (info.downloadedEvent?.sha256) {
      rows.push({ label: 'SHA256', value: info.downloadedEvent.sha256 });
    }
  } else if (stageIdx === 5) {
    // Ready
    if (info.downloadedEvent?.downloadedFile) {
      rows.push({ label: 'File', value: info.downloadedEvent.downloadedFile });
    }
  }

  if (isFailed && info.errorText) {
    rows.push({ label: 'Error', value: String(info.errorText) });
  }

  // Freeze / control info when failed
  if (isFailed && info.freezeUntil) {
    rows.push({ label: 'Frozen Until', value: formatTs(info.freezeUntil) });
  }

  return rows;
}

function buildUpdatePipeline(
  info: IAppUpdateInfo,
  downloadPercent: number,
): IPipelineStep[] {
  const stage = STATUS_TO_STAGE[info.status] ?? { index: -1 };
  const activeIdx = stage.index;
  const isFailed = !!stage.failed;

  return UPDATE_PIPELINE_LABELS.map((label, i) => {
    let state: IStepState = 'pending';
    if (i < activeIdx) {
      state = 'completed';
    } else if (i === activeIdx) {
      state = isFailed ? 'failed' : 'active';
    }

    // Attach details only to the active / failed step
    let details: { label: string; value: string }[] | undefined;
    if (i === activeIdx) {
      details = buildActiveDetails(info, i, isFailed);
    }

    // Attach download percent for the download step when active
    const pct = i === 1 && state === 'active' ? downloadPercent : undefined;

    return { label, state, details, percent: pct };
  });
}

// ---------------------------------------------------------------------------
// Pending Install Task pipeline
// ---------------------------------------------------------------------------
const TASK_PIPELINE_LABELS = [
  'Pending',
  'Running',
  'Applied (Verify)',
  'Completed',
];

const TASK_STATUS_TO_STAGE: Record<
  EPendingInstallTaskStatus,
  { index: number; failed?: boolean }
> = {
  [EPendingInstallTaskStatus.pending]: { index: 0 },
  [EPendingInstallTaskStatus.running]: { index: 1 },
  [EPendingInstallTaskStatus.appliedWaitingVerify]: { index: 2 },
  [EPendingInstallTaskStatus.failed]: { index: 1, failed: true },
};

function buildTaskPipeline(
  task: IPendingInstallTask | null | undefined,
): IPipelineStep[] | null {
  if (!task) return null;

  const stage = TASK_STATUS_TO_STAGE[task.status] ?? { index: -1 };
  const activeIdx = stage.index;
  const isFailed = !!stage.failed;

  return TASK_PIPELINE_LABELS.map((label, i) => {
    let state: IStepState = 'pending';
    if (i < activeIdx) {
      state = 'completed';
    } else if (i === activeIdx) {
      state = isFailed ? 'failed' : 'active';
    }

    let details: { label: string; value: string }[] | undefined;
    if (i === activeIdx) {
      details = [];
      details.push({ label: 'Task ID', value: task.taskId });
      details.push({ label: 'Type', value: task.type });
      details.push({ label: 'Action', value: task.action });
      details.push({
        label: 'Target',
        value: `v${task.targetAppVersion} #${task.targetBundleVersion}`,
      });
      details.push({
        label: 'Retry',
        value: String(task.retryCount),
      });
      details.push({
        label: 'Created',
        value: formatTs(task.createdAt),
      });
      if (task.runningStartedAt) {
        details.push({
          label: 'Running Since',
          value: formatTs(task.runningStartedAt),
        });
      }
      if (task.nextRetryAt) {
        details.push({
          label: 'Next Retry',
          value: formatTs(task.nextRetryAt),
        });
      }
      if (task.lastError) {
        details.push({ label: 'Error', value: task.lastError });
      }
    }

    return { label, state, details };
  });
}

// ---------------------------------------------------------------------------
// UI Components
// ---------------------------------------------------------------------------

const DOT_SIZE = 20;
const LINE_WIDTH = 2;

const stateColors: Record<IStepState, string> = {
  completed: '$iconSuccess',
  active: '$iconInfo',
  failed: '$iconCritical',
  pending: '$neutral5',
};

const stateBgColors: Record<IStepState, string> = {
  completed: '$bgSuccessStrong',
  active: '$bgInfoStrong',
  failed: '$bgCriticalStrong',
  pending: '$neutral3',
};

function PipelineDotContent({ state }: { state: IStepState }) {
  if (state === 'completed') {
    return (
      <SizableText size="$bodyXs" color={stateColors[state]}>
        ✓
      </SizableText>
    );
  }
  if (state === 'failed') {
    return (
      <SizableText size="$bodyXs" color={stateColors[state]}>
        ✕
      </SizableText>
    );
  }
  if (state === 'active') {
    return <Stack w={8} h={8} borderRadius={4} bg={stateColors[state]} />;
  }
  return null;
}

function PipelineDot({ state }: { state: IStepState }) {
  return (
    <Stack
      w={DOT_SIZE}
      h={DOT_SIZE}
      borderRadius={DOT_SIZE / 2}
      bg={stateBgColors[state]}
      alignItems="center"
      justifyContent="center"
    >
      <PipelineDotContent state={state} />
    </Stack>
  );
}

function PipelineStepRow({
  step,
  isLast,
}: {
  step: IPipelineStep;
  isLast: boolean;
}) {
  const hasDetails = step.details && step.details.length > 0;
  const isExpanded = step.state === 'active' || step.state === 'failed';

  return (
    <XStack>
      {/* Left column: dot + line */}
      <YStack alignItems="center" w={DOT_SIZE} mr="$3">
        <PipelineDot state={step.state} />
        {!isLast ? (
          <Stack
            flex={1}
            w={LINE_WIDTH}
            bg={step.state === 'completed' ? '$borderSuccess' : '$neutral5'}
            minHeight="$4"
          />
        ) : null}
      </YStack>

      {/* Right column: label + details */}
      <YStack flex={1} pb={isLast ? 0 : '$3'}>
        <SizableText
          size={isExpanded ? '$bodyMdMedium' : '$bodySm'}
          color={step.state === 'pending' ? '$textDisabled' : '$text'}
        >
          {step.label}
          {step.state === 'failed' ? ' — Failed' : ''}
          {step.percent !== undefined && step.percent !== null
            ? ` ${step.percent}%`
            : ''}
        </SizableText>

        {step.percent !== undefined && step.percent !== null ? (
          <XStack
            mt="$1.5"
            h={6}
            bg="$neutral3"
            borderRadius={3}
            overflow="hidden"
          >
            <Stack
              h={6}
              borderRadius={3}
              bg="$bgInfoStrong"
              width={`${Math.min(step.percent, 100)}%`}
            />
          </XStack>
        ) : null}

        {isExpanded && hasDetails ? (
          <YStack
            mt="$2"
            bg="$bgSubdued"
            borderRadius="$2"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$neutral3"
            px="$3"
            py="$2"
            gap="$0.5"
          >
            {step.details?.map((d) => (
              <XStack
                key={d.label}
                justifyContent="space-between"
                alignItems="flex-start"
                py="$1"
              >
                <SizableText size="$bodyXs" color="$textSubdued" flexShrink={0}>
                  {d.label}
                </SizableText>
                <SizableText
                  size="$bodyXs"
                  color={
                    step.state === 'failed' && d.label === 'Error'
                      ? '$textCritical'
                      : '$text'
                  }
                  flexShrink={1}
                  ml="$3"
                  textAlign="right"
                  wordWrap="break-word"
                >
                  {d.value}
                </SizableText>
              </XStack>
            ))}
          </YStack>
        ) : null}
      </YStack>
    </XStack>
  );
}

function Pipeline({
  title,
  steps,
  onRefresh,
}: {
  title: string;
  steps: IPipelineStep[];
  onRefresh?: () => void;
}) {
  return (
    <YStack gap="$2">
      <XStack alignItems="center" justifyContent="space-between">
        <SizableText size="$headingSm" color="$text">
          {title}
        </SizableText>
        {onRefresh ? (
          <IconButton
            icon="RefreshCcwOutline"
            size="small"
            variant="tertiary"
            onPress={onRefresh}
          />
        ) : null}
      </XStack>
      <YStack>
        {steps.map((step, i) => (
          <PipelineStepRow
            key={step.label}
            step={step}
            isLast={i === steps.length - 1}
          />
        ))}
      </YStack>
    </YStack>
  );
}

function PendingTaskSection({
  taskSteps,
  isLoading,
  onRefresh,
}: {
  taskSteps: IPipelineStep[] | null;
  isLoading: boolean;
  onRefresh?: () => void;
}) {
  if (isLoading) {
    return (
      <SizableText size="$bodySm" color="$textSubdued">
        Loading task...
      </SizableText>
    );
  }
  if (taskSteps) {
    return (
      <Pipeline
        title="Pending Install Task"
        steps={taskSteps}
        onRefresh={onRefresh}
      />
    );
  }
  return (
    <YStack gap="$1">
      <XStack alignItems="center" justifyContent="space-between">
        <SizableText size="$headingSm" color="$text">
          Pending Install Task
        </SizableText>
        {onRefresh ? (
          <IconButton
            icon="RefreshCcwOutline"
            size="small"
            variant="tertiary"
            onPress={onRefresh}
          />
        ) : null}
      </XStack>
      <SizableText size="$bodySm" color="$textSubdued">
        No pending task
      </SizableText>
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function DevBundleUpdateStatusModal() {
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const downloadPercent = useDownloadProgress();
  const [pendingTask, setPendingTask] = useState<
    IPendingInstallTask | null | undefined
  >(undefined);

  const fetchTask = useCallback(() => {
    void backgroundApiProxy.servicePendingInstallTask
      .getPendingInstallTask()
      .then((task) => {
        setPendingTask(task ?? null);
      });
  }, []);

  useEffect(() => {
    fetchTask();
    const timer = setInterval(fetchTask, 10_000);
    return () => clearInterval(timer);
  }, [fetchTask]);

  const updateSteps = useMemo(
    () => buildUpdatePipeline(appUpdateInfo, downloadPercent),
    [appUpdateInfo, downloadPercent],
  );

  const taskSteps = useMemo(
    () => buildTaskPipeline(pendingTask),
    [pendingTask],
  );

  return (
    <Page scrollEnabled>
      <Page.Header title="App/Bundle Update Status" />
      <Page.Body>
        <YStack px="$5" py="$4" gap="$6">
          {/* Summary bar */}
          <XStack
            bg="$bgSubdued"
            borderRadius="$3"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$neutral3"
            px="$4"
            py="$3"
            justifyContent="space-between"
            flexWrap="wrap"
            gap="$2"
          >
            <YStack>
              <SizableText size="$bodyXs" color="$textSubdued">
                Status
              </SizableText>
              <SizableText size="$bodySmMedium" color="$text">
                {appUpdateInfo.status}
              </SizableText>
            </YStack>
            <YStack>
              <SizableText size="$bodyXs" color="$textSubdued">
                Strategy
              </SizableText>
              <SizableText size="$bodySmMedium" color="$text">
                {strategyLabel[appUpdateInfo.updateStrategy]}
              </SizableText>
            </YStack>
            <YStack>
              <SizableText size="$bodyXs" color="$textSubdued">
                Version
              </SizableText>
              <SizableText size="$bodySmMedium" color="$text">
                {appUpdateInfo.latestVersion ?? '-'}
              </SizableText>
            </YStack>
            <YStack>
              <SizableText size="$bodyXs" color="$textSubdued">
                Bundle
              </SizableText>
              <SizableText size="$bodySmMedium" color="$text">
                {appUpdateInfo.jsBundleVersion ?? '-'}
              </SizableText>
            </YStack>
          </XStack>

          {/* Update pipeline */}
          <Pipeline
            title="Update Flow"
            steps={updateSteps}
            onRefresh={fetchTask}
          />

          <Divider />

          {/* Pending task pipeline */}
          <PendingTaskSection
            taskSteps={taskSteps}
            isLoading={pendingTask === undefined}
            onRefresh={fetchTask}
          />
        </YStack>
      </Page.Body>
    </Page>
  );
}

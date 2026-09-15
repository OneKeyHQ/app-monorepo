import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, Stack } from '@onekeyhq/components';
import {
  EFirmwareUpdateSteps,
  firmwareUpdateStepInfoAtom,
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdateStepInfoAtom,
  useHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { SUPPORT_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  EFirmwareUpdateTipMessages,
  ICheckAllFirmwareReleaseResult,
} from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { FirmwareUpdateExitPrevent } from '../components/FirmwareUpdateExitPrevent';
import { FirmwareUpdatePageFooter } from '../components/FirmwareUpdatePageLayout';
import { useGrantWebUsbAccess } from '../components/FirmwareUpdatePromptWebUsbDevice';
import { resolveFirmwareUpdateErrorPresentation } from '../componentsV2/firmwareUpdateErrorPresentation';
import { firmwareUpdateInstallCopy as copy } from '../componentsV2/firmwareUpdateInstallCopy';
import { FirmwareUpdateInstallView } from '../componentsV2/FirmwareUpdateInstallView';
import { useFirmwareUpdateInstallState } from '../componentsV2/useFirmwareUpdateInstallState';
import { useFirmwareUpdateItems } from '../componentsV2/useFirmwareUpdateItems';
import { shouldCancelDeviceWhenLeavingFirmwareUpdate } from '../firmwareUpdateWorkflowLifetime';
import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';
import { useFirmwareUpdateWorkflowLifetime } from '../hooks/useFirmwareUpdateHooks';
import { useStartFirmwareUpdateWorkflow } from '../hooks/useStartFirmwareUpdateWorkflow';
import { FirmwareUpdateTestIDs } from '../testIDs';

import type { IFirmwareUpdateInstallViewMode } from '../componentsV2/FirmwareUpdateInstallView';

const DONE_TRANSITION_MS = 1500;

/**
 * Body of the install page shared by the legacy and V2 routes. Every state
 * (updating, task failure, workflow failure, done) replaces the content in
 * place; nothing pops back to the changelog page.
 */
/**
 * The page scrolls only when the content overflows; otherwise the scroll
 * content must fill the viewport so the body can centre the device block
 * and pin the message slot above the footer.
 */
export const INSTALL_PAGE_SCROLL_PROPS = {
  contentContainerStyle: { flexGrow: 1 },
} as const;

export function FirmwareUpdateInstallPageContent({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const actions = useFirmwareUpdateActions();
  const [stepInfo, setStepInfo] = useFirmwareUpdateStepInfoAtom();
  const [retryInfo] = useFirmwareUpdateRetryAtom();
  const [hardwareUiState] = useHardwareUiStateAtom();
  const { start: startWorkflow } = useStartFirmwareUpdateWorkflow();

  const firmwareTipMessage = hardwareUiState?.payload?.firmwareTipData?.message;
  const [lastFirmwareTipMessage, setLastFirmwareTipMessage] = useState<
    EFirmwareUpdateTipMessages | undefined
  >();
  useEffect(() => {
    if (firmwareTipMessage) {
      setLastFirmwareTipMessage(
        firmwareTipMessage as EFirmwareUpdateTipMessages,
      );
    }
  }, [firmwareTipMessage]);

  useFirmwareUpdateWorkflowLifetime({
    onReallyLeave: async () => {
      await backgroundApiProxy.serviceFirmwareUpdate.exitUpdateWorkflow();
      if (
        result?.originalConnectId &&
        (await shouldCancelDeviceWhenLeavingFirmwareUpdate(
          platformEnv.isExtension === true,
          async () => (await firmwareUpdateStepInfoAtom.get()).step,
        ))
      ) {
        await backgroundApiProxy.serviceHardware.cancel({
          connectId: result.originalConnectId,
          forceDeviceResetToHome: true,
        });
      }
    },
  });

  const isDone = stepInfo.step === EFirmwareUpdateSteps.updateDone;
  const needOnboarding =
    stepInfo.step === EFirmwareUpdateSteps.updateDone
      ? (stepInfo.payload?.needOnboarding ?? false)
      : false;
  const [isDoneInternal, setIsDoneInternal] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsDoneInternal(isDone);
    }, DONE_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [isDone]);

  // Quitting while a task is mid-flight cancels the attempt; once the task
  // reports its failure the page yields back to the changelog with Retry.
  const [isCancelAttemptRequested, setIsCancelAttemptRequested] =
    useState(false);
  const shouldReturnToChangeLog =
    isCancelAttemptRequested && retryInfo !== undefined;
  useEffect(() => {
    if (shouldReturnToChangeLog) {
      navigation.pop();
    }
  }, [navigation, shouldReturnToChangeLog]);

  const { progress, stage, remainingTime, webUsbRequest, previousStepInfo } =
    useFirmwareUpdateInstallState({
      isDone,
      lastFirmwareTipMessage,
      intl,
    });
  const { items, hideDebugInfo } = useFirmwareUpdateItems(result);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const isWorkflowError = stepInfo.step === EFirmwareUpdateSteps.error;
  const activeRetryInfo =
    stepInfo.step === EFirmwareUpdateSteps.updateStart ? undefined : retryInfo;
  let mode: IFirmwareUpdateInstallViewMode = 'updating';
  if (isWorkflowError) {
    mode = 'workflowError';
  } else if (isDoneInternal) {
    mode = 'done';
  } else if (activeRetryInfo) {
    mode = 'error';
  }

  const workflowError = useMemo(
    () =>
      stepInfo.step === EFirmwareUpdateSteps.error
        ? resolveFirmwareUpdateErrorPresentation({
            error: stepInfo.payload.error,
            result,
            lastFirmwareTipMessage,
            intl,
          })
        : undefined,
    [intl, lastFirmwareTipMessage, result, stepInfo],
  );
  const taskError = useMemo(
    () =>
      activeRetryInfo
        ? resolveFirmwareUpdateErrorPresentation({
            error: activeRetryInfo.error,
            result,
            lastFirmwareTipMessage,
            intl,
          })
        : undefined,
    [activeRetryInfo, intl, lastFirmwareTipMessage, result],
  );

  const onRetryTask = useCallback(async () => {
    if (!retryInfo) {
      return;
    }
    await backgroundApiProxy.serviceFirmwareUpdate.clearHardwareUiStateBeforeStartUpdateWorkflow();
    setStepInfo({
      step: EFirmwareUpdateSteps.updateStart,
      payload: {
        startAtTime: Date.now(),
      },
    });
    await backgroundApiProxy.serviceFirmwareUpdate.retryUpdateTask({
      id: retryInfo.id,
      connectId: result?.updatingConnectId,
      releaseResult: result,
    });
  }, [result, retryInfo, setStepInfo]);

  const onRestartWorkflow = useCallback(async () => {
    if (!result) {
      return;
    }
    await backgroundApiProxy.serviceFirmwareUpdate.clearHardwareUiStateBeforeStartUpdateWorkflow();
    await startWorkflow({ result, navigateToInstallPage: false });
  }, [result, startWorkflow]);

  // Declared with a parameter so the footer does not auto-pop the page.
  const onGetHelp = useCallback((_close: unknown) => {
    openUrlExternal(SUPPORT_URL);
  }, []);

  const onCloseUpdateModal = useCallback(() => {
    actions.closeUpdateModal();
  }, [actions]);
  const onRestartOnboarding = useCallback(() => {
    void actions.restartOnboarding({ deviceType: result?.deviceType });
  }, [actions, result?.deviceType]);

  const { grantAccess, isConnecting: isGrantingUsb } = useGrantWebUsbAccess({
    previousStepInfo: previousStepInfo.current,
    requestType: webUsbRequest ?? 'bootloader',
  });

  // Model name only ("OneKey Pro"); the Bluetooth name stays in the header.
  const deviceName = result?.deviceType
    ? deviceUtils.getDeviceModelNameByType(result.deviceType)
    : '';
  const doneVersion = useMemo(() => {
    const primary =
      items.find((item) => item.key === 'firmware' || item.key === 'safeos') ??
      items[0];
    if (!primary?.toVersion) {
      return undefined;
    }
    const productName =
      primary.toTypeLabel ??
      (primary.key === 'safeos'
        ? copy.safeOS
        : intl.formatMessage({ id: ETranslations.global_firmware }));
    return {
      text: `${productName} ${primary.toVersion}`,
      releaseUrl: primary.releaseUrl,
    };
  }, [intl, items]);

  let webUsbInstruction: string | undefined;
  if (webUsbRequest === 'bootloader') {
    webUsbInstruction = copy.webUsbBootloaderInstruction(intl);
  } else if (webUsbRequest === 'switchFirmware') {
    webUsbInstruction = copy.webUsbSwitchFirmwareInstruction(intl);
  }

  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const debugInfo =
    process.env.NODE_ENV !== 'production' && !hideDebugInfo ? (
      <Stack alignItems="center" gap="$2">
        <Button
          testID="firmware-update-debug-info-btn"
          size="small"
          onPress={() => setShowDebugInfo((v) => !v)}
        >
          ProgressDebugInfo ({Math.round(progress)}%)
        </Button>
        {showDebugInfo ? (
          <SizableText size="$bodySm" color="$textSubdued">
            lastTipMessage: {lastFirmwareTipMessage ?? '--'} · step:{' '}
            {stepInfo.step}
          </SizableText>
        ) : null}
      </Stack>
    ) : null;

  // The done action sits in the content: a footer appearing on completion
  // would shrink the body and make the centred block jump.
  const doneAction = useMemo(
    () => ({
      text: needOnboarding ? copy.importWallet(intl) : copy.done(intl),
      onPress: needOnboarding ? onRestartOnboarding : onCloseUpdateModal,
      testID: FirmwareUpdateTestIDs.doneConfirmBtn,
    }),
    [intl, needOnboarding, onCloseUpdateModal, onRestartOnboarding],
  );

  let footer = null;
  if (mode === 'error' && taskError) {
    footer = (
      <FirmwareUpdatePageFooter
        onConfirmText={
          taskError.action.kind === 'retry' && taskError.action.text
            ? taskError.action.text
            : copy.retry(intl)
        }
        onConfirm={onRetryTask}
        confirmButtonProps={{ testID: FirmwareUpdateTestIDs.retryBtn }}
        onCancelText={copy.getHelp(intl)}
        onCancel={onGetHelp}
        cancelButtonProps={{
          variant: 'tertiary',
          testID: 'firmware-update-get-help-btn',
        }}
        buttonContainerProps={{
          $md: { flexDirection: 'column-reverse', gap: '$3' },
        }}
      />
    );
  } else if (mode === 'workflowError' && workflowError) {
    if (workflowError.action.kind === 'retry') {
      footer = (
        <FirmwareUpdatePageFooter
          onConfirmText={workflowError.action.text ?? copy.retry(intl)}
          onConfirm={onRestartWorkflow}
          confirmButtonProps={{ testID: FirmwareUpdateTestIDs.retryBtn }}
        />
      );
    } else if (workflowError.action.kind === 'link') {
      const { url, text } = workflowError.action;
      footer = (
        <FirmwareUpdatePageFooter
          onConfirmText={text}
          onConfirm={() => openUrlExternal(url)}
          confirmButtonProps={{
            iconAfter: 'ArrowTopRightOutline',
            testID: FirmwareUpdateTestIDs.viewTutorialBtn,
          }}
        />
      );
    }
  } else if (mode === 'updating' && webUsbRequest) {
    footer = (
      <FirmwareUpdatePageFooter
        onConfirmText={copy.grantUsbAccess(intl)}
        onConfirm={() => {
          void grantAccess();
        }}
        confirmButtonProps={{
          loading: isGrantingUsb,
          disabled: isGrantingUsb,
          testID: FirmwareUpdateTestIDs.grantUsbAccessBtn,
        }}
      />
    );
  }

  const preventExit = mode === 'updating' || mode === 'error';

  return (
    <>
      {preventExit ? (
        <FirmwareUpdateExitPrevent
          preserveWorkflowOnCancel={
            stepInfo.step === EFirmwareUpdateSteps.installing
              ? retryInfo === undefined
              : false
          }
          shouldPreventRemove={!shouldReturnToChangeLog}
          onCancelAttempt={() => setIsCancelAttemptRequested(true)}
        />
      ) : null}
      <FirmwareUpdateInstallView
        mode={mode}
        deviceType={result?.deviceType}
        deviceName={deviceName}
        items={items}
        stage={stage}
        progress={progress}
        remainingTimeText={
          mode === 'updating' && remainingTime
            ? copy.remainingTime(intl, remainingTime)
            : undefined
        }
        errorSentence={taskError?.sentence}
        tutorialUrl={taskError?.tutorialUrl}
        workflowError={workflowError}
        webUsbInstruction={webUsbInstruction}
        doneVersionText={doneVersion?.text}
        doneReleaseUrl={doneVersion?.releaseUrl}
        doneAction={doneAction}
        detailsExpanded={detailsExpanded}
        onToggleDetails={setDetailsExpanded}
        debugInfo={debugInfo}
      />
      {footer}
    </>
  );
}

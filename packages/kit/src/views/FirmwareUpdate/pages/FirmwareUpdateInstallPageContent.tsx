import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page, SizableText, Stack } from '@onekeyhq/components';
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
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  EFirmwareUpdateTipMessages,
  ICheckAllFirmwareReleaseResult,
} from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  FirmwareUpdateExitPrevent,
  ForceExtensionUpdatingFromExpandTab,
} from '../components/FirmwareUpdateExitPrevent';
import {
  FirmwareUpdatePageFooter,
  FirmwareUpdatePageLayout,
} from '../components/FirmwareUpdatePageLayout';
import { useGrantWebUsbAccess } from '../components/FirmwareUpdatePromptWebUsbDevice';
import { resolveFirmwareUpdateErrorPresentation } from '../componentsV2/firmwareUpdateErrorPresentation';
import { firmwareUpdateInstallCopy as copy } from '../componentsV2/firmwareUpdateInstallCopy';
import { FirmwareUpdateInstallView } from '../componentsV2/FirmwareUpdateInstallView';
import { getPrimaryFirmwareUpdateItem } from '../componentsV2/firmwareUpdateInstallViewModel';
import { useFirmwareUpdateInstallState } from '../componentsV2/useFirmwareUpdateInstallState';
import { useFirmwareUpdateItems } from '../componentsV2/useFirmwareUpdateItems';
import { shouldCancelDeviceWhenLeavingFirmwareUpdate } from '../firmwareUpdateWorkflowLifetime';
import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';
import { useFirmwareUpdateWorkflowLifetime } from '../hooks/useFirmwareUpdateHooks';
import { useStartFirmwareUpdateWorkflow } from '../hooks/useStartFirmwareUpdateWorkflow';
import { FirmwareUpdateTestIDs } from '../testIDs';

import type { IFirmwareUpdateInstallViewMode } from '../componentsV2/FirmwareUpdateInstallView';

const DONE_TRANSITION_MS = 1500;
/** Product name, not translated. */
const SAFE_OS_PRODUCT_NAME = 'SafeOS';

/**
 * The page scrolls only when the content overflows; otherwise the scroll
 * content must fill the viewport so the body can centre the device block
 * and pin the message slot above the footer.
 */
const INSTALL_PAGE_SCROLL_PROPS = {
  contentContainerStyle: { flexGrow: 1 },
} as const;
const INSTALL_PAGE_CONTAINER_STYLE = { py: '0', px: '$5', flex: 1 } as const;

/** Shell shared by the legacy and V2 install routes. */
export function FirmwareUpdateInstallPage({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const intl = useIntl();
  return (
    <Page scrollEnabled scrollProps={INSTALL_PAGE_SCROLL_PROPS}>
      <FirmwareUpdatePageLayout
        title={intl.formatMessage({
          id: ETranslations.firmware_update_install_page__title,
        })}
        containerStyle={INSTALL_PAGE_CONTAINER_STYLE}
      >
        <ForceExtensionUpdatingFromExpandTab />
        <FirmwareUpdateInstallPageContent result={result} />
      </FirmwareUpdatePageLayout>
    </Page>
  );
}

/**
 * Body of the install page. Every state (updating, task failure, workflow
 * failure, done) replaces the content in place; nothing pops back to the
 * changelog page.
 */
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
    if (!isDone) {
      setIsDoneInternal(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      setIsDoneInternal(true);
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
    requestType: webUsbRequest,
  });

  const doneVersion = useMemo(() => {
    const primary = getPrimaryFirmwareUpdateItem(items);
    if (!primary?.toVersion) {
      return undefined;
    }
    const productName =
      primary.toTypeLabel ??
      (primary.key === 'safeos'
        ? SAFE_OS_PRODUCT_NAME
        : intl.formatMessage({ id: ETranslations.global_firmware }));
    return {
      text: `${productName} ${primary.toVersion}`,
      releaseUrl: primary.releaseUrl,
    };
  }, [intl, items]);

  let webUsbInstruction: string | undefined;
  if (webUsbRequest === 'bootloader') {
    webUsbInstruction = intl.formatMessage({
      id: ETranslations.firmware_update_grant_usb_instruction,
    });
  } else if (webUsbRequest === 'switchFirmware') {
    webUsbInstruction = intl.formatMessage({
      id: ETranslations.firmware_update_switch_firmware_reconnect_device,
    });
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
      text: intl.formatMessage({
        id: needOnboarding
          ? ETranslations.global_import_wallet
          : ETranslations.global_done,
      }),
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
            : intl.formatMessage({ id: ETranslations.global_retry })
        }
        onConfirm={onRetryTask}
        confirmButtonProps={{ testID: FirmwareUpdateTestIDs.retryBtn }}
        onCancelText={intl.formatMessage({
          id: ETranslations.firmware_update_get_help__action,
        })}
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
          onConfirmText={
            workflowError.action.text ??
            intl.formatMessage({ id: ETranslations.global_retry })
          }
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
        onConfirmText={intl.formatMessage({
          id: ETranslations.device_grant_usb_access,
        })}
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

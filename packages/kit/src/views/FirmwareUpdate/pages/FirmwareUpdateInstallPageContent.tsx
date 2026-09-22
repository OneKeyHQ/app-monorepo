import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Page,
  SizableText,
  Stack,
  usePreventRemove,
} from '@onekeyhq/components';
import {
  EFirmwareUpdateSteps,
  firmwareUpdateStepInfoAtom,
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdateStepInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { SUPPORT_URL } from '@onekeyhq/shared/src/config/appConfig';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { toUserFacingFirmwareUpdateError } from '@onekeyhq/shared/src/errors/utils/firmwareUpdateErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  EHardwareCallContext,
  type ICheckAllFirmwareReleaseResult,
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
import { getTargetFirmwareTypeLabel, isFirmwareTypeSwitch } from '../utils';

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

/**
 * A workflow-level failure (battery, Bridge, transport, version gate) is
 * validated from the release result, so Retry must re-check the device
 * instead of replaying the result that already failed.
 */
async function recheckFirmwareRelease(
  result: ICheckAllFirmwareReleaseResult,
): Promise<ICheckAllFirmwareReleaseResult> {
  const transport =
    await backgroundApiProxy.serviceHardware.resolveHardwareTransport({
      connectId: result.originalConnectId,
      hardwareCallContext: EHardwareCallContext.UPDATE_FIRMWARE,
    });
  const firmware = result.updateInfos.firmware;
  return backgroundApiProxy.serviceFirmwareUpdate.checkAllFirmwareRelease({
    connectId: transport.connectId,
    firmwareType: isFirmwareTypeSwitch(firmware)
      ? firmware?.toFirmwareType
      : undefined,
    resolvedTransportType: transport.transportType,
  });
}

// Module-level so the header options stay reference-stable across renders.
const renderNoHeaderLeft = () => null;

/**
 * Once the update succeeded there is nothing to go back to. The header drops
 * its back button, and a back gesture or hardware back closes the whole modal
 * instead of revealing the changelog page underneath.
 */
function FirmwareUpdateDoneBackGuard() {
  const navigation = useAppNavigation();
  const isClosingRef = useRef(false);
  usePreventRemove(true, ({ data }) => {
    const { type } = data.action;
    // popStack() below re-enters this callback with the parent's action, and
    // anything that is not a plain back (e.g. the onboarding reset) passes.
    if (isClosingRef.current || (type !== 'GO_BACK' && type !== 'POP')) {
      navigation.dispatch(data.action);
      return;
    }
    isClosingRef.current = true;
    navigation.popStack();
  });
  return (
    // headerLeft covers the custom header, headerBackVisible the native iOS one.
    <Page.Header headerLeft={renderNoHeaderLeft} headerBackVisible={false} />
  );
}

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
  result: routeResult,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const actions = useFirmwareUpdateActions();
  const [stepInfo, setStepInfo] = useFirmwareUpdateStepInfoAtom();
  const [retryInfo] = useFirmwareUpdateRetryAtom();
  const { start: startWorkflow } = useStartFirmwareUpdateWorkflow();

  // Replaced by a fresh check when a workflow failure is retried.
  const [result, setResult] = useState(routeResult);
  const resultRef = useRef(result);
  resultRef.current = result;

  useFirmwareUpdateWorkflowLifetime({
    onReallyLeave: async () => {
      await backgroundApiProxy.serviceFirmwareUpdate.exitUpdateWorkflow();
      const connectId = resultRef.current?.originalConnectId;
      if (
        connectId &&
        (await shouldCancelDeviceWhenLeavingFirmwareUpdate(
          platformEnv.isExtension === true,
          async () => (await firmwareUpdateStepInfoAtom.get()).step,
        ))
      ) {
        await backgroundApiProxy.serviceHardware.cancel({
          connectId,
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

  const {
    progress,
    stage,
    remainingTime,
    lastFirmwareTipMessage,
    webUsbRequest,
    previousStepInfo,
  } = useFirmwareUpdateInstallState({ isDone });
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
    const current = resultRef.current;
    if (!current) {
      return;
    }
    await backgroundApiProxy.serviceFirmwareUpdate.clearHardwareUiStateBeforeStartUpdateWorkflow();
    let fresh: ICheckAllFirmwareReleaseResult;
    try {
      fresh = await recheckFirmwareRelease(current);
    } catch (error) {
      setStepInfo({
        step: EFirmwareUpdateSteps.error,
        payload: {
          error: toUserFacingFirmwareUpdateError(
            toPlainErrorObject(error as any),
          ),
        },
      });
      return;
    }
    setResult(fresh);
    await startWorkflow({ result: fresh, navigateToInstallPage: false });
  }, [setStepInfo, startWorkflow]);

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

  const firmwareInfo = result?.updateInfos?.firmware;
  const doneVersion = useMemo(() => {
    const primary = getPrimaryFirmwareUpdateItem(items);
    if (!primary?.toVersion) {
      return undefined;
    }
    // The done line has room for the full type name, and a switch is the
    // one case where the type is the news.
    let productName: string;
    if (isFirmwareTypeSwitch(firmwareInfo)) {
      productName = getTargetFirmwareTypeLabel({
        firmwareType: firmwareInfo?.toFirmwareType,
        intl,
      });
    } else if (primary.key === 'safeos') {
      productName = SAFE_OS_PRODUCT_NAME;
    } else {
      productName = intl.formatMessage({ id: ETranslations.global_firmware });
    }
    return {
      text: `${productName} ${primary.toVersion}`,
      releaseUrl: primary.releaseUrl,
    };
  }, [firmwareInfo, intl, items]);

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
    // Get help is always offered; the primary action follows the error's
    // declared action (a downgrade refusal has none, a tutorial is a link).
    const getHelpProps = {
      onCancelText: intl.formatMessage({
        id: ETranslations.firmware_update_get_help__action,
      }),
      onCancel: onGetHelp,
      cancelButtonProps: {
        variant: 'tertiary',
        testID: 'firmware-update-get-help-btn',
      },
      stacked: true,
    } as const;
    if (taskError.action.kind === 'retry') {
      footer = (
        <FirmwareUpdatePageFooter
          onConfirmText={
            taskError.action.text ??
            intl.formatMessage({ id: ETranslations.global_retry })
          }
          onConfirm={onRetryTask}
          confirmButtonProps={{ testID: FirmwareUpdateTestIDs.retryBtn }}
          {...getHelpProps}
        />
      );
    } else if (taskError.action.kind === 'link') {
      const { url, text } = taskError.action;
      footer = (
        <FirmwareUpdatePageFooter
          onConfirmText={text}
          onConfirm={() => openUrlExternal(url)}
          confirmButtonProps={{
            iconAfter: 'ArrowTopRightOutline',
            testID: FirmwareUpdateTestIDs.viewTutorialBtn,
          }}
          {...getHelpProps}
        />
      );
    } else {
      footer = <FirmwareUpdatePageFooter {...getHelpProps} />;
    }
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
      {mode === 'done' ? <FirmwareUpdateDoneBackGuard /> : null}
      <FirmwareUpdateInstallView
        mode={mode}
        deviceType={result?.deviceType}
        deviceColor={deviceUtils.getDeviceColorFromFeatures({
          deviceType: result?.deviceType,
          features: result?.features,
        })}
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

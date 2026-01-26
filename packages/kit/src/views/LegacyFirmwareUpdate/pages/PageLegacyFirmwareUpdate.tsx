import { useCallback, useEffect, useMemo, useState } from 'react';

import { Page, YStack } from '@onekeyhq/components';
import {
  ELegacyFirmwareUpdateSteps,
  useLegacyFirmwareUpdateProgressAtom,
  useLegacyFirmwareUpdateStepAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EModalLegacyFirmwareUpdateRoutes,
  IModalLegacyFirmwareUpdateParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { FirmwareUpdatePageLayout } from '../../FirmwareUpdate/components/FirmwareUpdatePageLayout';
import { LegacyFirmwareUpdateExitPrevent } from '../components/LegacyFirmwareUpdateExitPrevent';
import { LegacyUpdateCheckList } from '../components/LegacyUpdateCheckList';
import { LegacyUpdateProgress } from '../components/LegacyUpdateProgress';
import { LegacyUpdateResult } from '../components/LegacyUpdateResult';
import { LegacyUpdateStepIndicator } from '../components/LegacyUpdateStepIndicator';
import { MiniBootloaderModeGuide } from '../components/MiniBootloaderModeGuide';
import { WebUsbDeviceReselectPrompt } from '../components/WebUsbDeviceReselectPrompt';

function PageLegacyFirmwareUpdate() {
  const route = useAppRoute<
    IModalLegacyFirmwareUpdateParamList,
    EModalLegacyFirmwareUpdateRoutes.LegacyUpdate
  >();
  const navigation = useAppNavigation();

  const {
    connectId,
    deviceType,
    currentFirmwareVersion,
    currentBootloaderVersion,
    targetFirmwareVersion,
    isBootloaderMode,
  } = route.params;

  const [stepInfo] = useLegacyFirmwareUpdateStepAtom();
  const [progressInfo] = useLegacyFirmwareUpdateProgressAtom();
  const [isStarting, setIsStarting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const isDone = stepInfo.step === ELegacyFirmwareUpdateSteps.done;
  const isError = stepInfo.step === ELegacyFirmwareUpdateSteps.error;
  const isIdle = stepInfo.step === ELegacyFirmwareUpdateSteps.idle;
  const isRunning =
    !isIdle &&
    stepInfo.step !== ELegacyFirmwareUpdateSteps.done &&
    stepInfo.step !== ELegacyFirmwareUpdateSteps.error;

  const handleStartUpdate = useCallback(async () => {
    setIsStarting(true);
    setHasStarted(true);
    try {
      await backgroundApiProxy.serviceLegacyFirmwareUpdate.startLegacyUpdate({
        connectId,
        deviceType,
        currentFirmwareVersion,
        currentBootloaderVersion,
        targetFirmwareVersion,
        isBootloaderMode,
      });
    } finally {
      setIsStarting(false);
    }
  }, [
    connectId,
    deviceType,
    currentFirmwareVersion,
    currentBootloaderVersion,
    targetFirmwareVersion,
    isBootloaderMode,
  ]);

  const handleRetry = useCallback(async () => {
    await backgroundApiProxy.serviceLegacyFirmwareUpdate.resetState();
    setHasStarted(false);
  }, []);

  const onCloseModal = useCallback(() => {
    navigation.popStack();
  }, [navigation]);

  // Reset state on unmount
  useEffect(
    () => () => {
      console.log('PageLegacyFirmwareUpdate unmounted');
      void backgroundApiProxy.serviceLegacyFirmwareUpdate.exitUpdateWorkflow();
    },
    [],
  );

  const content = useMemo(() => {
    // Show check list when idle and not started
    if (isIdle && !hasStarted) {
      return (
        <LegacyUpdateCheckList
          deviceType={deviceType}
          currentFirmwareVersion={currentFirmwareVersion}
          currentBootloaderVersion={currentBootloaderVersion}
          targetFirmwareVersion={targetFirmwareVersion}
          onStartUpdate={handleStartUpdate}
          isStarting={isStarting}
        />
      );
    }

    // Waiting for Mini bootloader mode
    if (stepInfo.step === ELegacyFirmwareUpdateSteps.waitingBootloaderMode) {
      return (
        <MiniBootloaderModeGuide
          deviceType={stepInfo.payload?.deviceType || deviceType}
        />
      );
    }

    // WebUSB device reselect
    if (stepInfo.step === ELegacyFirmwareUpdateSteps.requestDeviceReselect) {
      return <WebUsbDeviceReselectPrompt />;
    }

    // Error state
    if (isError && stepInfo.step === ELegacyFirmwareUpdateSteps.error) {
      return (
        <LegacyUpdateResult
          success={false}
          error={stepInfo.payload?.error}
          onRetry={handleRetry}
          onClose={onCloseModal}
        />
      );
    }

    // Done state
    if (isDone) {
      const needOnboarding =
        stepInfo.step === ELegacyFirmwareUpdateSteps.done &&
        stepInfo.payload?.needOnboarding;

      return (
        <LegacyUpdateResult
          success
          needOnboarding={needOnboarding}
          onClose={onCloseModal}
        />
      );
    }

    // Running state - show progress
    const phase =
      stepInfo.step === ELegacyFirmwareUpdateSteps.installingFirmware
        ? stepInfo.payload?.phase
        : undefined;

    return (
      <LegacyUpdateProgress
        step={stepInfo.step}
        progress={progressInfo.progress}
        message={progressInfo.message}
        phase={phase}
      />
    );
  }, [
    isIdle,
    hasStarted,
    deviceType,
    currentFirmwareVersion,
    currentBootloaderVersion,
    targetFirmwareVersion,
    handleStartUpdate,
    isStarting,
    stepInfo,
    isError,
    handleRetry,
    onCloseModal,
    isDone,
    progressInfo,
  ]);

  const footerContent = useMemo(() => {
    // Footer is handled by LegacyUpdateResult for done/error states
    if (isDone || isError) {
      return null;
    }
    // Footer is handled by LegacyUpdateCheckList for idle state
    if (isIdle && !hasStarted) {
      return null;
    }
    return null;
  }, [isDone, isError, isIdle, hasStarted]);

  const showStepIndicator = hasStarted && !isError;

  return (
    <Page scrollEnabled>
      <FirmwareUpdatePageLayout
        containerStyle={{
          py: '$4',
          px: '$5',
        }}
      >
        {isRunning ? <LegacyFirmwareUpdateExitPrevent /> : null}
        <YStack flex={1}>
          {showStepIndicator ? (
            <LegacyUpdateStepIndicator currentStep={stepInfo.step} />
          ) : null}
          {content}
        </YStack>
        {footerContent}
      </FirmwareUpdatePageLayout>
    </Page>
  );
}

export default PageLegacyFirmwareUpdate;

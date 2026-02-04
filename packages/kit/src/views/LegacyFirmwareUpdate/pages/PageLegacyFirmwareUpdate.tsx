import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StackActions } from '@react-navigation/routers';

import { Page, YStack, rootNavigationRef } from '@onekeyhq/components';
import {
  ELegacyFirmwareUpdateSteps,
  useLegacyFirmwareUpdateStepAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EModalFirmwareUpdateRoutes,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import type {
  EModalLegacyFirmwareUpdateRoutes,
  IModalLegacyFirmwareUpdateParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { FirmwareUpdatePageLayout } from '../../FirmwareUpdate/components/FirmwareUpdatePageLayout';
import { LegacyFirmwareInstallingView } from '../components/LegacyFirmwareInstallingView';
import { LegacyFirmwareUpdateExitPrevent } from '../components/LegacyFirmwareUpdateExitPrevent';
import { LegacyUpdateCheckList } from '../components/LegacyUpdateCheckList';
import { LegacyUpdateResult } from '../components/LegacyUpdateResult';
import { MiniBootloaderModeGuide } from '../components/MiniBootloaderModeGuide';
import { WebUsbDeviceReselectPrompt } from '../components/WebUsbDeviceReselectPrompt';

// Device polling interval in milliseconds (same as firmware-updater-web)
const DEVICE_POLLING_INTERVAL = 5000;

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
    autoStart,
  } = route.params;

  const [stepInfo] = useLegacyFirmwareUpdateStepAtom();
  const [isStarting, setIsStarting] = useState(false);
  // If autoStart is true, we skip the CheckList (it was already confirmed)
  const [hasStarted, setHasStarted] = useState(!!autoStart);
  // Track if we've already triggered the continuation to normal flow
  const hasTriggeredContinuation = useRef(false);
  // Track device polling state
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  // Track if we're currently attempting to restart the update
  const isRestartingRef = useRef(false);

  const isDone = stepInfo.step === ELegacyFirmwareUpdateSteps.done;
  const isError = stepInfo.step === ELegacyFirmwareUpdateSteps.error;
  const isIdle = stepInfo.step === ELegacyFirmwareUpdateSteps.idle;
  const isWaitingBootloaderMode =
    stepInfo.step === ELegacyFirmwareUpdateSteps.waitingBootloaderMode;
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

  // Auto-start update if autoStart is true (CheckList was already confirmed)
  useEffect(() => {
    if (
      autoStart &&
      !isStarting &&
      stepInfo.step === ELegacyFirmwareUpdateSteps.idle
    ) {
      void handleStartUpdate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // Device polling when waiting for bootloader mode
  // Similar to firmware-updater-web, poll every 5 seconds to detect device connection
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    // Reset the restarting flag when entering waitingBootloaderMode state
    if (isWaitingBootloaderMode) {
      isRestartingRef.current = false;
    }

    // Start polling when in waitingBootloaderMode state
    if (isWaitingBootloaderMode) {
      setIsPolling(true);

      const pollForDevice = async () => {
        // Skip if already attempting to restart
        if (isRestartingRef.current) {
          console.log('Device polling: already restarting, skip this poll');
          return;
        }

        try {
          const response =
            await backgroundApiProxy.serviceHardware.searchDevices();

          if (
            response &&
            response.success &&
            response.payload &&
            response.payload.length > 0
          ) {
            // Device detected - try to restart update with bootloader mode flag
            // The SDK will verify if the device is actually in bootloader mode
            console.log(
              'Device detected, attempting to restart update with bootloader mode...',
            );

            // Mark as restarting to prevent multiple attempts
            isRestartingRef.current = true;

            // Restart the update with bootloader mode flag
            setIsStarting(true);
            try {
              const result =
                await backgroundApiProxy.serviceLegacyFirmwareUpdate.startLegacyUpdate(
                  {
                    connectId,
                    deviceType,
                    currentFirmwareVersion,
                    currentBootloaderVersion,
                    targetFirmwareVersion,
                    isBootloaderMode: true, // User has entered bootloader mode manually
                  },
                );

              // If the update still needs bootloader mode, the device wasn't in bootloader mode
              // Reset the flag and continue polling
              if (result.needsBootloaderMode) {
                console.log(
                  'Device not in bootloader mode yet, continuing to poll...',
                );
                isRestartingRef.current = false;
              } else {
                // Update succeeded or is in progress, stop polling
                if (intervalId) {
                  clearInterval(intervalId);
                  intervalId = null;
                }
                setIsPolling(false);
              }
            } catch (error) {
              console.log('Restart update error:', error);
              // Reset the flag to allow retrying
              isRestartingRef.current = false;
            } finally {
              setIsStarting(false);
            }
          }
        } catch (error) {
          console.log('Device polling error:', error);
          // Continue polling even on error
        }
      };

      // Delay the first poll to give user time to enter bootloader mode
      // Don't poll immediately to avoid the flicker issue
      intervalId = setInterval(pollForDevice, DEVICE_POLLING_INTERVAL);
      pollingIntervalRef.current = intervalId;
    }

    // Cleanup on unmount or when state changes
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [
    isWaitingBootloaderMode,
    connectId,
    deviceType,
    currentFirmwareVersion,
    currentBootloaderVersion,
    targetFirmwareVersion,
  ]);

  // When Legacy firmware update completes, automatically continue to normal flow
  // for remaining updates (bootloader, BLE, etc.)
  useEffect(() => {
    if (isDone && !hasTriggeredContinuation.current) {
      hasTriggeredContinuation.current = true;

      // Show "complete" state briefly (handled by LegacyFirmwareInstallingView),
      // then continue to normal flow for remaining updates
      setTimeout(() => {
        // Close this Legacy modal and open normal ChangeLog modal
        navigation.popStack();

        // Open normal firmware update ChangeLog modal for remaining updates
        if (rootNavigationRef.current) {
          rootNavigationRef.current?.dispatch(
            StackActions.push(ERootRoutes.Modal, {
              screen: EModalRoutes.FirmwareUpdateModal,
              params: {
                screen: EModalFirmwareUpdateRoutes.ChangeLog,
                params: {
                  connectId,
                },
              },
            }),
          );
        }
      }, 3000); // Wait 3s to show completion message before transitioning
    }
  }, [isDone, connectId, navigation]);

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
          isPolling={isPolling}
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

    // Running and Done states - use unified progress view (same as normal flow)
    return (
      <LegacyFirmwareInstallingView
        deviceType={deviceType}
        currentFirmwareVersion={currentFirmwareVersion}
        currentBootloaderVersion={currentBootloaderVersion}
        targetFirmwareVersion={targetFirmwareVersion}
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
    isPolling,
  ]);

  const footerContent = useMemo(() => {
    // Footer is handled by LegacyUpdateResult for error state
    if (isError) {
      return null;
    }
    // Footer is handled by LegacyUpdateCheckList for idle state
    if (isIdle && !hasStarted) {
      return null;
    }
    // When done, don't show footer - we automatically continue to normal flow
    // for remaining updates (bootloader, BLE, etc.)
    return null;
  }, [isError, isIdle, hasStarted]);

  return (
    <Page scrollEnabled>
      <FirmwareUpdatePageLayout
        containerStyle={{
          py: '0',
          px: '$5',
        }}
      >
        {isRunning ? <LegacyFirmwareUpdateExitPrevent /> : null}
        <YStack flex={1}>{content}</YStack>
        {footerContent}
      </FirmwareUpdatePageLayout>
    </Page>
  );
}

export default PageLegacyFirmwareUpdate;

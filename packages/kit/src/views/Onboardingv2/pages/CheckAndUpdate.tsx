import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import pRetry from 'p-retry';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  Dialog,
  DialogContainer,
  HeightTransition,
  SizableText,
  Theme,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useFirmwareUpdateActions } from '../../FirmwareUpdate/hooks/useFirmwareUpdateActions';
import {
  CheckStepIllustration,
  type ICheckStepIllustrationTone,
} from '../components/CheckStepIllustration';
import { Confetti } from '../components/Confetti';
import { OnboardingPage } from '../components/Layout';
import {
  useConnectDeviceError,
  useDeviceConnect,
} from '../hooks/useDeviceConnect';
import { usePrepareUSBConnectForFirmwareUpdate } from '../hooks/usePrepareUSBConnectForFirmwareUpdate';
import { OnboardingTestIDs } from '../testIDs';
import { getForceTransportType } from '../utils';

import type { Features, KnownDevice, SearchDevice } from '@onekeyfe/hd-core';

enum ECheckAndUpdateStepState {
  Idle = 'idle',
  InProgress = 'inProgress',
  Warning = 'warning',
  Skipped = 'skipped',
  Success = 'success',
  Error = 'error',
}

enum ECheckAndUpdateStepId {
  GenuineCheck = 'genuine-check',
  FirmwareCheck = 'firmware-check',
}

// Illustration glyph tint per step state (idle / in progress stay neutral).
const STEP_STATE_TONE: Partial<
  Record<ECheckAndUpdateStepState, ICheckStepIllustrationTone>
> = {
  [ECheckAndUpdateStepState.Success]: 'success',
  [ECheckAndUpdateStepState.Warning]: 'warning',
  [ECheckAndUpdateStepState.Skipped]: 'warning',
  [ECheckAndUpdateStepState.Error]: 'critical',
};

function CheckAndUpdatePage({
  route: routeParams,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.CheckAndUpdate
>) {
  const intl = useIntl();
  const { deviceData, tabValue } = routeParams?.params || {};
  console.log('deviceData', deviceData);
  const navigation = useAppNavigation();
  const reactNavigation = useNavigation();
  const isFirmwareVerifiedRef = useRef<boolean | undefined>(undefined);
  const deviceFeaturesRef = useRef<Features | undefined>(undefined);
  const hasUpgradeForceRef = useRef(false);
  // Generation counter for checkFirmwareUpdate: each call claims a new id, so
  // a previous round that out-lived its 30s watchdog (hung transport call)
  // cannot write its late result, error, or timeout over the state a newer
  // retry round owns — step state alone can't tell two rounds apart.
  const firmwareCheckRunIdRef = useRef(0);

  const [currentDevice, setCurrentDevice] = useState<SearchDevice | undefined>(
    deviceData.device as SearchDevice | undefined,
  );

  const deviceLabel = useMemo(() => {
    if ((currentDevice as KnownDevice)?.label) {
      return (currentDevice as KnownDevice).label;
    }
    return (currentDevice as SearchDevice).name;
  }, [currentDevice]);

  // Product model name (e.g. "OneKey Pro"), not the BLE name (e.g. "Pro 062B").
  // Falls back to the BLE label when the device type is unknown so the string
  // is never empty.
  const deviceModelName = useMemo(() => {
    const deviceType = currentDevice?.deviceType;
    if (!deviceType) {
      return deviceLabel;
    }
    return deviceUtils.getDeviceModelNameByType(deviceType) || deviceLabel;
  }, [currentDevice, deviceLabel]);

  const {
    verifyHardware,
    ensureActiveConnection,
    getActiveDevice,
    ensureStopScan,
  } = useDeviceConnect({
    setCurrentDevice,
  });
  const { prepareUSBConnect, restoreOriginalTransport } =
    usePrepareUSBConnectForFirmwareUpdate();
  const ensureTransportType = useCallback(async () => {
    if (!tabValue) {
      return;
    }
    const forceTransportType = await getForceTransportType(tabValue);
    if (forceTransportType) {
      await backgroundApiProxy.serviceHardware.setForceTransportType({
        forceTransportType,
      });
    }
  }, [tabValue]);

  const [steps, setSteps] = useState<
    {
      id: ECheckAndUpdateStepId;
      title: string;
      description?: string;
      state?: ECheckAndUpdateStepState;
      errorMessage?: string;
    }[]
  >(() => [
    {
      id: ECheckAndUpdateStepId.GenuineCheck,
      title: intl.formatMessage({
        id: ETranslations.device_auth_request_title,
      }),
      description: intl.formatMessage(
        {
          id: ETranslations.genuine_check_desc,
        },
        { deviceLabel: deviceModelName },
      ),
      state: ECheckAndUpdateStepState.Idle,
    },
    {
      id: ECheckAndUpdateStepId.FirmwareCheck,
      title: intl.formatMessage({
        id: ETranslations.firmware_check,
      }),
      description: intl.formatMessage(
        {
          id: ETranslations.firmware_check_desc,
        },
        { deviceLabel: deviceModelName },
      ),
      state: ECheckAndUpdateStepState.Idle,
    },
  ]);

  const [celebrate, setCelebrate] = useState(false);
  // The flow may proceed once the firmware step is terminal-ok: Success or
  // Skipped both reveal the "Continue" button, but only a real Success fires
  // the celebratory confetti — skipping a check is not a pass.
  const firmwareStepState = steps.find(
    (step) => step.id === ECheckAndUpdateStepId.FirmwareCheck,
  )?.state;
  const isReady =
    firmwareStepState === ECheckAndUpdateStepState.Success ||
    firmwareStepState === ECheckAndUpdateStepState.Skipped;
  useEffect(() => {
    if (firmwareStepState === ECheckAndUpdateStepState.Success) {
      setCelebrate(true);
    }
  }, [firmwareStepState]);

  const actions = useFirmwareUpdateActions();
  const toFirmwareUpgradePage = useCallback(async () => {
    // Use shared USB preparation logic
    const usbPrepareResult = await prepareUSBConnect({
      device: currentDevice as SearchDevice,
      features: deviceFeaturesRef.current,
    });

    if (!usbPrepareResult) {
      // USB preparation failed (dialog already shown)
      return;
    }

    // Original transport is stored in singleton, will be restored in useFocusEffect
    await actions.openChangeLogModal({
      connectId: usbPrepareResult.connectId,
    });
  }, [actions, currentDevice, prepareUSBConnect]);

  // 30s watchdog for checkFirmwareUpdate. It targets the firmware step
  // explicitly — matching "whichever step is InProgress" could stamp the
  // genuine row when both steps are momentarily in progress. On firing it
  // retires the hung round BEFORE surfacing Retry, so that round's late
  // result can never overwrite whatever the user chooses next, and it asks
  // bg to cancel the in-flight device call — bg owns the SDK/device
  // resource; a main-side ref alone cannot stop it on split-runtime targets.
  const createStepTimeout = useCallback(
    (isStale: () => boolean, getConnectId: () => string | undefined) => {
      const timeout = setTimeout(() => {
        if (isStale()) {
          // A newer round already took over; this watchdog is obsolete and
          // must not retire or cancel that round.
          return;
        }
        firmwareCheckRunIdRef.current += 1;
        const connectId = getConnectId();
        if (connectId) {
          void backgroundApiProxy.serviceHardware.cancel({ connectId });
        }
        setSteps((prev) => {
          if (prev[1].state !== ECheckAndUpdateStepState.InProgress) {
            return prev;
          }
          const newSteps = [...prev];
          newSteps[1] = {
            ...newSteps[1],
            state: ECheckAndUpdateStepState.Error,
            errorMessage: intl.formatMessage({
              id: ETranslations.hardware_connect_timeout_error,
            }),
          };
          return newSteps;
        });
      }, 30 * 1000);
      return () => clearTimeout(timeout);
    },
    [intl],
  );

  // Firmware check is done — hand off to the dedicated DeviceSetup page, which
  // runs the device-status check and shows the on-device setup instructions
  // when the device is not yet initialized. Pass the latest device reference
  // (its connectId may have changed after a firmware update) so DeviceSetup
  // and FinalizeWalletSetup talk to the right device.
  const toDeviceSetup = useCallback(() => {
    navigation.push(EOnboardingPagesV2.DeviceSetup, {
      deviceData: {
        ...deviceData,
        device: (getActiveDevice() ??
          currentDevice ??
          deviceData.device) as SearchDevice,
      },
      tabValue,
      isFirmwareVerified: isFirmwareVerifiedRef.current,
    });
  }, [navigation, deviceData, getActiveDevice, currentDevice, tabValue]);

  // Retry connecting to device after firmware update
  const retryDeviceConnectionAfterUpdate = useCallback(
    async (connectId: string) => {
      try {
        await pRetry(
          async (attemptCount) => {
            console.log(
              `Attempting to connect to device after firmware update (attempt ${attemptCount}/5)...`,
            );

            await backgroundApiProxy.serviceHardware.getFeaturesWithoutCache({
              connectId,
              params: {
                retryCount: 1,
                skipWebDevicePrompt: true,
              },
            });

            console.log('Device connection successful after firmware update');
          },
          {
            retries: 10,
            factor: 2,
            minTimeout: 1000,
            maxTimeout: 8000,
            onFailedAttempt: (error) => {
              console.warn(
                `Device connection attempt ${error.attemptNumber} failed:`,
                error.message,
              );
              if (
                error.attemptNumber <
                error.retriesLeft + error.attemptNumber
              ) {
                console.log(`Retrying... (${error.retriesLeft} attempts left)`);
              }
            },
          },
        );
      } catch (error) {
        console.error(
          'Failed to connect to device after firmware update, all retries exhausted',
          error,
        );

        // No direct step write here — the thrown message reaches the row via
        // checkFirmwareUpdate's guarded catch, which also drops stale rounds.
        throw new OneKeyLocalError(
          intl.formatMessage({
            id: ETranslations.hardware_device_not_find_error,
          }),
        );
      }
    },
    [intl],
  );

  const checkFirmwareUpdate = useCallback(
    async (params?: { checkAfterUpdate: boolean }) => {
      // Claim the active round; any still-running older round becomes stale
      // and all of its step writes below are dropped.
      firmwareCheckRunIdRef.current += 1;
      const runId = firmwareCheckRunIdRef.current;
      const isStale = () => runId !== firmwareCheckRunIdRef.current;
      // The watchdog cancels against whichever connectId this round has
      // resolved so far.
      let watchdogConnectId: string | undefined;
      const setDeviceNotFoundErrorMessageStep = () => {
        setSteps((prev) => {
          if (
            isStale() ||
            prev[1].state !== ECheckAndUpdateStepState.InProgress
          ) {
            return prev;
          }
          const newSteps = [...prev];
          newSteps[1] = {
            ...newSteps[1],
            state: ECheckAndUpdateStepState.Error,
            errorMessage: intl.formatMessage({
              id: ETranslations.device_not_connected,
            }),
          };
          return newSteps;
        });
      };
      // Re-entry (retry / recheck) may find the step still in Error from the
      // previous attempt; flip it back to InProgress right away and drop the
      // stale message so the UI shows the loading beam instead of the old
      // failure while the new request runs. Unguarded on purpose — the newest
      // round takes over the row.
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[1] = {
          ...newSteps[1],
          state: ECheckAndUpdateStepState.InProgress,
          errorMessage: undefined,
        };
        return newSteps;
      });
      const cancelTimeout = createStepTimeout(isStale, () => watchdogConnectId);
      try {
        await ensureTransportType();
        const baseDevice =
          getActiveDevice() ?? currentDevice ?? deviceData.device;
        if (!baseDevice?.connectId) {
          setDeviceNotFoundErrorMessageStep();
          return;
        }
        watchdogConnectId = baseDevice.connectId;
        await ensureActiveConnection(baseDevice as SearchDevice);
        const latestDevice = getActiveDevice() ?? baseDevice;
        setCurrentDevice(latestDevice as SearchDevice);

        if (!latestDevice?.connectId) {
          setDeviceNotFoundErrorMessageStep();
          return;
        }
        const compatibleConnectId =
          await backgroundApiProxy.serviceHardware.getCompatibleConnectId({
            connectId: latestDevice.connectId,
            hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
          });
        watchdogConnectId = compatibleConnectId;

        // Wait for hardware to restart after firmware update
        if (params?.checkAfterUpdate) {
          await retryDeviceConnectionAfterUpdate(compatibleConnectId);
        }

        const r =
          await backgroundApiProxy.serviceFirmwareUpdate.checkAllFirmwareRelease(
            {
              connectId: compatibleConnectId,
              skipCancel: true,
              firmwareType: undefined,
            },
          );
        if (isStale()) {
          // A newer retry owns the UI (and the refs feeding DeviceSetup);
          // this late result must not overwrite it.
          return;
        }
        if (r) {
          if (r.features) {
            deviceFeaturesRef.current = r.features;
          }
          hasUpgradeForceRef.current =
            r.updateInfos?.firmware?.hasUpgradeForce ||
            r.updateInfos?.ble?.hasUpgradeForce ||
            false;
          // Only the firmware step is written here — the genuine step's
          // terminal state (Success or Skipped) belongs to handleVerifyHardware
          // and must survive the firmware result.
          setSteps((prev) => {
            const newSteps = [...prev];
            newSteps[1] = {
              ...newSteps[1],
              state: r.hasUpgrade
                ? ECheckAndUpdateStepState.Warning
                : ECheckAndUpdateStepState.Success,
            };
            return newSteps;
          });
        } else {
          setSteps((prev) => {
            const newSteps = [...prev];
            newSteps[1] = {
              ...newSteps[1],
              state: ECheckAndUpdateStepState.Error,
              errorMessage: intl.formatMessage({
                id: ETranslations.hardware_hardware_device_not_find_error,
              }),
            };
            return newSteps;
          });
        }
      } catch (error) {
        // Surface the real failure instead of leaving the row spinning until
        // the watchdog replaces it with a generic timeout. Skip when this
        // round went stale, and when a deeper layer already stamped a
        // specific Error (connect-error events) — only claim the failure
        // while the step is still in progress.
        setSteps((prev) => {
          if (
            isStale() ||
            prev[1].state !== ECheckAndUpdateStepState.InProgress
          ) {
            return prev;
          }
          const newSteps = [...prev];
          newSteps[1] = {
            ...newSteps[1],
            state: ECheckAndUpdateStepState.Error,
            errorMessage:
              (error as Error | undefined)?.message ||
              intl.formatMessage({ id: ETranslations.global_unknown_error }),
          };
          return newSteps;
        });
      } finally {
        cancelTimeout();
      }
    },
    [
      createStepTimeout,
      ensureTransportType,
      getActiveDevice,
      currentDevice,
      deviceData.device,
      ensureActiveConnection,
      intl,
      retryDeviceConnectionAfterUpdate,
    ],
  );

  // Track firmware update completion time
  const firmwareUpdateFinishTimeRef = useRef<number | null>(null);
  const FIRMWARE_RECHECK_DELAY = 10_000; // 10 seconds

  // Listen to firmware update completion event and record timestamp
  useEffect(() => {
    const handleFirmwareUpdateFinish = () => {
      console.log('Firmware update finished, recording timestamp...');
      firmwareUpdateFinishTimeRef.current = Date.now();
    };

    appEventBus.on(
      EAppEventBusNames.FinishFirmwareUpdate,
      handleFirmwareUpdateFinish,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.FinishFirmwareUpdate,
        handleFirmwareUpdateFinish,
      );
    };
  }, []);

  // When page regains focus, check if firmware was updated and recheck if needed
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await restoreOriginalTransport();
      })();

      const finishTime = firmwareUpdateFinishTimeRef.current;
      if (!finishTime) {
        return;
      }

      const elapsed = Date.now() - finishTime;
      const remainingDelay = Math.max(0, FIRMWARE_RECHECK_DELAY - elapsed);

      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[1] = {
          ...newSteps[1],
          state: ECheckAndUpdateStepState.InProgress,
        };
        return newSteps;
      });

      // Wait for remaining delay (0 if already >= 10s), then recheck firmware
      const timeoutId = setTimeout(() => {
        void checkFirmwareUpdate({
          checkAfterUpdate: true,
        });
        // Clear the timestamp after rechecking
        firmwareUpdateFinishTimeRef.current = null;
      }, remainingDelay);

      return () => {
        clearTimeout(timeoutId);
      };
    }, [checkFirmwareUpdate, restoreOriginalTransport]),
  );

  useEffect(() => {
    const unsubscribe = reactNavigation.addListener('beforeRemove', () => {
      // Clean up forceTransportType when leaving this page
      void backgroundApiProxy.serviceHardware.clearForceTransportType();
    });

    return unsubscribe;
  }, [reactNavigation]);

  const handleVerifyHardware = useCallback(async () => {
    // Double-check: ensure device scanning is fully stopped before starting verification
    await ensureStopScan();
    await ensureTransportType();

    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[0] = {
        ...newSteps[0],
        state: ECheckAndUpdateStepState.InProgress,
        errorMessage: undefined,
      };
      return newSteps;
    });

    try {
      const [result] = await Promise.all([
        verifyHardware(currentDevice as SearchDevice, tabValue),
        new Promise<void>((resolve) => {
          setTimeout(resolve, 1200);
        }),
      ]);
      const latestDevice =
        getActiveDevice() ??
        currentDevice ??
        (deviceData.device as SearchDevice | undefined);
      setCurrentDevice(latestDevice);
      console.log('verifyHardware', result);
      if (!result) {
        throw new OneKeyLocalError(
          intl.formatMessage({ id: ETranslations.global_unknown_error }),
        );
      }
      // Skipping (dev skip or "continue anyway" when the verify service is
      // unavailable) is not a verification pass — record it as Skipped so the
      // step doesn't claim the device is genuine.
      let genuineState = ECheckAndUpdateStepState.Error;
      if (result.verified) {
        genuineState = ECheckAndUpdateStepState.Success;
      } else if (result.skipVerification) {
        genuineState = ECheckAndUpdateStepState.Skipped;
      }
      const shouldContinueToFirmwareCheck =
        genuineState !== ECheckAndUpdateStepState.Error;
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[0] = {
          ...newSteps[0],
          state: genuineState,
          errorMessage:
            genuineState === ECheckAndUpdateStepState.Error
              ? result.result?.message
              : undefined,
        };
        if (shouldContinueToFirmwareCheck) {
          newSteps[1] = {
            ...newSteps[1],
            state: ECheckAndUpdateStepState.InProgress,
          };
        }
        return newSteps;
      });
      if (shouldContinueToFirmwareCheck) {
        setTimeout(() => {
          void checkFirmwareUpdate();
        }, 150);
      }
      isFirmwareVerifiedRef.current = !!result.verified;
    } catch (_error) {
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[0] = {
          ...newSteps[0],
          state: ECheckAndUpdateStepState.Error,
        };
        return newSteps;
      });
    }
  }, [
    ensureStopScan,
    ensureTransportType,
    verifyHardware,
    deviceData.device,
    tabValue,
    intl,
    checkFirmwareUpdate,
    getActiveDevice,
    currentDevice,
  ]);

  const handleRetry = useCallback(async () => {
    const currentErrorStep = steps.find(
      (step) => step.state === ECheckAndUpdateStepState.Error,
    );
    if (!currentErrorStep) {
      await handleVerifyHardware();
      return;
    }
    if (currentErrorStep.id === ECheckAndUpdateStepId.GenuineCheck) {
      await handleVerifyHardware();
    } else if (currentErrorStep.id === ECheckAndUpdateStepId.FirmwareCheck) {
      await checkFirmwareUpdate();
    }
  }, [checkFirmwareUpdate, handleVerifyHardware, steps]);

  const handleSkipUpdate = useCallback(() => {
    Dialog.show({
      // The onboarding flow is force-dark (routes/Modal/Navigator.tsx wraps it
      // in <Theme name="dark">), but Dialog.show renders into the global
      // full-window overlay portal OUTSIDE that wrapper, so by default this
      // dialog pops in the app/system (light) theme. Wrapping the whole
      // DialogContainer in <Theme name="dark"> re-themes the entire chrome
      // (card, header close icon, warning icon, footer buttons) via React
      // context to match the onboarding flow. Mirrors
      // useShowOnboardingInviteCodeDialog.
      dialogContainer: ({ ref }) => (
        <Theme name="dark">
          <DialogContainer
            ref={ref}
            icon="CubeSolid"
            tone="warning"
            title={intl.formatMessage({
              id: ETranslations.skip_firmware_check_dialog_title,
            })}
            description={intl.formatMessage({
              id: ETranslations.skip_firmware_check_dialog_desc,
            })}
            showFooter
            showConfirmButton
            showCancelButton
            onConfirm={() => {
              // Declining the optional update is recorded honestly as
              // Skipped — the flow continues, but without success visuals.
              setSteps((prev) => {
                const newSteps = [...prev];
                newSteps[1] = {
                  ...newSteps[1],
                  state: ECheckAndUpdateStepState.Skipped,
                };
                return newSteps;
              });
            }}
            onClose={async () => undefined}
          />
        </Theme>
      ),
    });
  }, [intl]);

  useConnectDeviceError(
    useCallback(
      (errorMessageId: ETranslations) => {
        setSteps((prev) => {
          const inProgressStep = prev.find(
            (step) => step.state === ECheckAndUpdateStepState.InProgress,
          );
          if (inProgressStep) {
            inProgressStep.state = ECheckAndUpdateStepState.Error;
            inProgressStep.errorMessage = intl.formatMessage({
              id: errorMessageId,
            });
          }
          return [...prev];
        });
      },
      [intl],
    ),
  );

  const handleSkipCurrentStep = useCallback(() => {
    let currentStepId: ECheckAndUpdateStepId | undefined;
    setSteps((prev) => {
      const index = prev.findIndex(
        (step) => step.state === ECheckAndUpdateStepState.Error,
      );
      if (index === -1) {
        return prev;
      }
      currentStepId = prev[index].id;
      const newSteps = [...prev];
      newSteps[index] = {
        ...newSteps[index],
        state: ECheckAndUpdateStepState.Skipped,
        errorMessage: undefined,
      };
      return newSteps;
    });
    setTimeout(() => {
      // GenuineCheck has no skip affordance today, but keep the chain intact
      // defensively. Skipping a failed FirmwareCheck marks it Skipped above,
      // which still reveals "Continue" (isReady accepts Skipped) without the
      // success visuals.
      if (currentStepId === ECheckAndUpdateStepId.GenuineCheck) {
        void checkFirmwareUpdate();
      }
    }, 150);
  }, [checkFirmwareUpdate]);

  // Primary CTA at the foot of the flow. The two states are mutually exclusive
  // (all-idle → verify the device; ready → continue to setup), so the single
  // bottom slot renders whichever is active.
  let bottomCta: {
    key: string;
    testID: string;
    onPress: () => void;
    label: string;
  } | null = null;
  if (!steps.some((step) => step.state !== ECheckAndUpdateStepState.Idle)) {
    bottomCta = {
      key: 'verify',
      testID: OnboardingTestIDs.checkAndUpdateVerifyBtn,
      onPress: handleVerifyHardware,
      label: intl.formatMessage(
        { id: ETranslations.check_my_deviceLabel },
        { deviceLabel: deviceModelName },
      ),
    };
  } else if (isReady) {
    bottomCta = {
      key: 'continue',
      testID: OnboardingTestIDs.checkAndUpdateContinueToSetupBtn,
      onPress: toDeviceSetup,
      label: intl.formatMessage({ id: ETranslations.global_continue }),
    };
  }

  return (
    <OnboardingPage
      testID={OnboardingTestIDs.checkAndUpdatePage}
      headerTitle={intl.formatMessage({
        id: ETranslations.check_and_update,
      })}
      scrollable
      alignTop
      narrow
      contentContainerProps={{ gap: '$10', pt: '$5' }}
      foregroundLayer={celebrate ? <Confetti /> : null}
    >
      {steps.map((step, index) => {
        // On Success, collapse the row to a single celebratory title and hide
        // the description. The genuine title interpolates the product model
        // name (e.g. "OneKey Pro"), not the BLE label.
        const isStepSuccess = step.state === ECheckAndUpdateStepState.Success;
        // Skipped collapses like Success but states the outcome honestly
        // ("You skipped verification") instead of claiming genuineness.
        const isStepSkipped = step.state === ECheckAndUpdateStepState.Skipped;
        // Success and Skipped both collapse the row: title only, no highlight.
        const isStepCollapsed = isStepSuccess || isStepSkipped;
        // Glyph tint per state; the border beam runs only while in progress.
        const illustrationTone: ICheckStepIllustrationTone =
          (step.state && STEP_STATE_TONE[step.state]) || 'neutral';
        let displayTitle = step.title;
        if (isStepSuccess) {
          displayTitle =
            step.id === ECheckAndUpdateStepId.GenuineCheck
              ? intl.formatMessage(
                  { id: ETranslations.genuine_check_success_title },
                  { deviceLabel: deviceModelName },
                )
              : intl.formatMessage({
                  id: ETranslations.firmware_check_success_title,
                });
        } else if (isStepSkipped) {
          displayTitle =
            step.id === ECheckAndUpdateStepId.GenuineCheck
              ? intl.formatMessage({
                  id: ETranslations.genuine_check_skipped_title,
                })
              : intl.formatMessage({
                  id: ETranslations.firmware_check_skipped_title,
                });
        }
        const displayDescription = isStepCollapsed
          ? undefined
          : step.description;
        return (
          <YStack key={step.title}>
            {/* highlight background */}
            <AnimatePresence>
              {step.state &&
              !isStepCollapsed &&
              step.state !== ECheckAndUpdateStepState.Idle ? (
                <YStack
                  animation="quick"
                  animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                  enterStyle={{
                    opacity: 0,
                    scale: 0.97,
                    filter: 'blur(4px)',
                  }}
                  exitStyle={{
                    opacity: 0,
                    scale: 0.97,
                    filter: 'blur(4px)',
                  }}
                  position="absolute"
                  left={-10}
                  top={-10}
                  right={-10}
                  bottom={-10}
                  $gtMd={{
                    left: -16,
                    top: -16,
                    right: -16,
                    bottom: -16,
                  }}
                  bg="$bgSubdued"
                  borderRadius="$4"
                  borderCurve="continuous"
                  $platform-web={{
                    boxShadow:
                      'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.16), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18), 0 3px 3px -1.5px rgba(0, 0, 0, 0.18), 0 6px 6px -3px rgba(0, 0, 0, 0.18), 0 12px 12px -6px rgba(0, 0, 0, 0.18)',
                  }}
                  $platform-native={{
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: '$neutral5',
                  }}
                  zIndex={0}
                />
              ) : null}
            </AnimatePresence>
            {/* connected line — anchored to the 56px illustration's centre */}
            {index !== steps.length - 1 ? (
              <YStack
                w={2}
                position="absolute"
                left={27}
                top={56}
                bottom={-40}
                gap="$1"
                overflow="hidden"
              >
                {Array.from({ length: 20 }).map((_, i) => (
                  <YStack
                    key={i}
                    w="100%"
                    h="$1"
                    bg="$border"
                    borderRadius="$full"
                  />
                ))}
              </YStack>
            ) : null}
            <XStack gap="$5">
              {/* No corner state badge — the glyph tint + border beam already
                  carry the state. */}
              <CheckStepIllustration
                kind={
                  step.id === ECheckAndUpdateStepId.GenuineCheck
                    ? 'genuine'
                    : 'firmware'
                }
                tone={illustrationTone}
                beaming={step.state === ECheckAndUpdateStepState.InProgress}
              />
              <YStack gap="$1" flex={1} alignSelf="center">
                <SizableText size="$headingSm">{displayTitle}</SizableText>
                {displayDescription ? (
                  <SizableText color="$textSubdued">
                    {displayDescription}
                  </SizableText>
                ) : null}
              </YStack>
            </XStack>
            <HeightTransition initialHeight={0}>
              {/* update */}
              {step.id === ECheckAndUpdateStepId.FirmwareCheck &&
              step.state === ECheckAndUpdateStepState.Warning ? (
                <XStack
                  gap="$2"
                  mt="$4"
                  pt="$4"
                  borderWidth={0}
                  borderTopWidth={StyleSheet.hairlineWidth}
                  borderTopColor="$borderSubdued"
                  alignItems="center"
                >
                  <SizableText
                    size="$bodyMdMedium"
                    color="$textInfo"
                    flex={1}
                    textAlign="left"
                  >
                    {intl.formatMessage({
                      id: ETranslations.hardware_status_update_available,
                    })}
                  </SizableText>
                  <XStack gap="$2">
                    <Button
                      testID={OnboardingTestIDs.checkAndUpdateUpdateBtn}
                      variant="primary"
                      onPress={toFirmwareUpgradePage}
                    >
                      {intl.formatMessage({
                        id: ETranslations.update_update_now,
                      })}
                    </Button>
                    {!hasUpgradeForceRef.current ? (
                      <Button
                        testID={OnboardingTestIDs.checkAndUpdateSkipUpdateBtn}
                        onPress={handleSkipUpdate}
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_skip,
                        })}
                      </Button>
                    ) : null}
                  </XStack>
                </XStack>
              ) : null}
              {/* fallback */}
              {step.state === ECheckAndUpdateStepState.Error ? (
                <XStack
                  gap="$2"
                  mt="$4"
                  pt="$4"
                  borderWidth={0}
                  borderTopWidth={StyleSheet.hairlineWidth}
                  borderTopColor="$borderSubdued"
                  alignItems="center"
                >
                  <SizableText
                    size="$bodyMdMedium"
                    color="$textCritical"
                    flex={1}
                    textAlign="left"
                  >
                    {step.errorMessage ??
                      intl.formatMessage({
                        id: ETranslations.genuine_check_interrupt,
                      })}
                  </SizableText>
                  <XStack gap="$2">
                    <Button
                      testID={OnboardingTestIDs.checkAndUpdateRetryBtn}
                      variant="primary"
                      onPress={handleRetry}
                    >
                      {intl.formatMessage({
                        id: ETranslations.global_retry,
                      })}
                    </Button>
                    {step.id !== ECheckAndUpdateStepId.GenuineCheck ? (
                      <Button
                        testID={OnboardingTestIDs.checkAndUpdateSkipStepBtn}
                        onPress={handleSkipCurrentStep}
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_skip,
                        })}
                      </Button>
                    ) : null}
                  </XStack>
                </XStack>
              ) : null}
            </HeightTransition>
          </YStack>
        );
      })}
      {/* The page never scrolls, so on mobile the CTA pins to the bottom of the
          viewport (mt:auto in the flex column) with the shared onboarding bottom
          gap ($5, matching BackupWalletReminder / CreateNewWallet); wider
          layouts keep it inline under the steps. Keyed so a verify→continue
          switch cross-fades. */}
      <AnimatePresence initial={false}>
        {bottomCta ? (
          <Button
            key={bottomCta.key}
            testID={bottomCta.testID}
            animation="quick"
            animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
            variant="primary"
            size="large"
            onPress={bottomCta.onPress}
            $md={{ mt: 'auto', mb: '$5' }}
            enterStyle={{
              opacity: 0,
              scale: 0.97,
            }}
            exitStyle={{
              opacity: 0,
              scale: 0.97,
            }}
          >
            {bottomCta.label}
          </Button>
        ) : null}
      </AnimatePresence>
    </OnboardingPage>
  );
}

export default function CheckAndUpdate({
  route,
  navigation,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.CheckAndUpdate
>) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home, // TODO read from router
      }}
    >
      <CheckAndUpdatePage route={route} navigation={navigation} />
    </AccountSelectorProviderMirror>
  );
}

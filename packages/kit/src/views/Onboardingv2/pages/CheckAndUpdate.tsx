import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import pRetry, { AbortError } from 'p-retry';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  Dialog,
  DialogContainer,
  EInPageDialogType,
  HeightTransition,
  SizableText,
  Theme,
  XStack,
  YStack,
  useInPageDialog,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { useDeviceStageBurst } from '@onekeyhq/kit/src/hooks/useDeviceStageBurst';
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
import {
  type IBootloaderModeDialogHost,
  useFirmwareUpdateActions,
} from '../../FirmwareUpdate/hooks/useFirmwareUpdateActions';
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

import {
  ECheckAndUpdateStepId,
  ECheckAndUpdateStepState,
  armPostUpdateRecheck,
  beginPostUpdateRecheck,
  isCheckAndUpdateReady,
  isCheckAndUpdateRetryDisabled,
  isCheckAndUpdateStepAccepted,
  keepPostUpdateGenuineRecheckArmed,
} from './checkAndUpdateStepState';
import { createFirmwareRecheckTimer } from './firmwareRecheckUtils';

import type { Features, KnownDevice, SearchDevice } from '@onekeyfe/hd-core';

// Illustration glyph tint per step state (idle / in progress stay neutral).
const STEP_STATE_TONE: Partial<
  Record<ECheckAndUpdateStepState, ICheckStepIllustrationTone>
> = {
  [ECheckAndUpdateStepState.Success]: 'success',
  [ECheckAndUpdateStepState.Warning]: 'warning',
  [ECheckAndUpdateStepState.Skipped]: 'warning',
  [ECheckAndUpdateStepState.Error]: 'critical',
};

// Keep normal checks within 60s, including the 45s manifest fetch budget.
// Post-update rounds must outlast the reconnect loop in
// retryDeviceConnectionAfterUpdate (pRetry delays alone sum to ~63s — a
// rebooting device after a firmware flash is expected to be away that long),
// otherwise the watchdog would retire a round that is working as designed.
const STEP_TIMEOUT_MS = 60 * 1000;
const POST_UPDATE_STEP_TIMEOUT_MS = 120 * 1000;

const BootloaderDialogHostBridge = forwardRef<IBootloaderModeDialogHost>(
  function BootloaderDialogHostBridge(_props, ref) {
    const dialogHost = useInPageDialog(EInPageDialogType.inOnboardingPage);
    useImperativeHandle(ref, () => dialogHost, [dialogHost]);
    return null;
  },
);

function CheckAndUpdatePage({
  route: routeParams,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.CheckAndUpdate
>) {
  const intl = useIntl();
  const { ensureBurst, endBurst } = useDeviceStageBurst();
  const { connectProtocol, deviceData, tabValue } = routeParams?.params || {};
  const navigation = useAppNavigation();
  const reactNavigation = useNavigation();
  const isFirmwareVerifiedRef = useRef<boolean | undefined>(undefined);
  const deviceFeaturesRef = useRef<Features | undefined>(undefined);
  const hasUpgradeForceRef = useRef(false);
  // Generation counter for checkFirmwareUpdate: each call claims a new id, so
  // a previous round that out-lived its watchdog (hung transport call) cannot
  // write its late result, error, or timeout over the state a newer retry
  // round owns — step state alone can't tell two rounds apart.
  const firmwareCheckRunIdRef = useRef(0);
  // One-shot timestamp for the focus-effect recheck after firmware runtime state
  // changes. Clear it when the timer fires or the user explicitly skips; it only
  // drives scheduling and delay calculations.
  const [firmwareRuntimeChangeTime, setFirmwareRuntimeChangeTime] = useState<
    number | null
  >(null);
  const firmwareRecheckCancelRef = useRef<(() => void) | null>(null);
  // Track "the device may still be rebooting" separately. Set it when an update
  // succeeds, and clear it only after a check completes successfully.
  // While set, every check, including manual retries, uses the patient reconnect path.
  const pendingPostUpdateReconnectRef = useRef(false);
  const bootloaderDialogHostRef = useRef<IBootloaderModeDialogHost>(null);
  const getBootloaderDialogHost = useCallback(
    () => bootloaderDialogHostRef.current ?? undefined,
    [],
  );
  const [isFirmwareRecheckPending, setIsFirmwareRecheckPending] =
    useState(false);

  const cancelFirmwareRecheck = useCallback(() => {
    firmwareRecheckCancelRef.current?.();
    firmwareRecheckCancelRef.current = null;
  }, []);

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
    return deviceUtils.getDefaultDeviceLabel(deviceType) || deviceLabel;
  }, [currentDevice, deviceLabel]);

  const {
    verifyHardware,
    ensureActiveConnection,
    rebindDeviceAfterFirmwareUpdate,
    getActiveDevice,
    getActiveDeviceFeatures,
    ensureStopScan,
  } = useDeviceConnect({
    setCurrentDevice,
    getBootloaderDialogHost,
  });
  const { prepareUSBConnect, restoreOriginalTransport } =
    usePrepareUSBConnectForFirmwareUpdate();
  const ensureTransportType = useCallback(async () => {
    if (!tabValue) {
      return;
    }
    const activeFeaturesProtocol = getActiveDeviceFeatures()?.protocol;
    const confirmedConnectProtocol =
      activeFeaturesProtocol === 'V1' || activeFeaturesProtocol === 'V2'
        ? activeFeaturesProtocol
        : (getActiveDevice()?.connectProtocol ??
          currentDevice?.connectProtocol ??
          connectProtocol);
    const forceTransportType = await getForceTransportType(tabValue, {
      connectProtocol: confirmedConnectProtocol,
    });
    if (forceTransportType) {
      await backgroundApiProxy.serviceHardware.setForceTransportType({
        forceTransportType,
      });
    }
  }, [
    connectProtocol,
    currentDevice?.connectProtocol,
    getActiveDevice,
    getActiveDeviceFeatures,
    tabValue,
  ]);

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
  // Both checks must be terminal-ok before setup can continue. Bootloader
  // recovery can temporarily restart the two checks in a different order.
  const genuineStepState = steps.find(
    (step) => step.id === ECheckAndUpdateStepId.GenuineCheck,
  )?.state;
  const firmwareStepState = steps.find(
    (step) => step.id === ECheckAndUpdateStepId.FirmwareCheck,
  )?.state;
  const isReady = isCheckAndUpdateReady(steps);
  const isAnyStepInProgress = isCheckAndUpdateRetryDisabled(
    steps,
    isFirmwareRecheckPending,
  );
  useEffect(() => {
    setCelebrate(
      isReady && firmwareStepState === ECheckAndUpdateStepState.Success,
    );
  }, [firmwareStepState, isReady]);
  // Lets the focus-effect guard read the latest firmware step state without
  // joining the focus callback's dependency array.
  const firmwareStepStateRef = useRef(firmwareStepState);
  useEffect(() => {
    firmwareStepStateRef.current = firmwareStepState;
  }, [firmwareStepState]);
  const genuineStepStateRef = useRef(genuineStepState);
  useEffect(() => {
    genuineStepStateRef.current = genuineStepState;
  }, [genuineStepState]);
  const [
    shouldReverifyGenuineAfterUpdate,
    setShouldReverifyGenuineAfterUpdate,
  ] = useState(false);

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

  // Watchdog for checkFirmwareUpdate. It targets the firmware step
  // explicitly — matching "whichever step is InProgress" could stamp the
  // genuine row when both steps are momentarily in progress. On firing it
  // retires the hung round BEFORE surfacing Retry, so that round's late
  // result can never overwrite whatever the user chooses next, and it asks
  // bg to cancel the in-flight device call — bg owns the SDK/device
  // resource; a main-side ref alone cannot stop it on split-runtime targets.
  const createStepTimeout = useCallback(
    (
      isStale: () => boolean,
      getConnectId: () => string | undefined,
      timeoutMs: number,
    ) => {
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
      }, timeoutMs);
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
    const activeDevice = (getActiveDevice() ??
      currentDevice ??
      deviceData.device) as SearchDevice;
    const activeFeaturesProtocol = getActiveDeviceFeatures()?.protocol;
    const confirmedConnectProtocol =
      activeFeaturesProtocol === 'V1' || activeFeaturesProtocol === 'V2'
        ? activeFeaturesProtocol
        : (activeDevice.connectProtocol ?? connectProtocol);
    navigation.push(EOnboardingPagesV2.DeviceSetup, {
      connectProtocol: confirmedConnectProtocol,
      deviceData: {
        ...deviceData,
        device: {
          ...activeDevice,
          connectProtocol: confirmedConnectProtocol,
        },
      },
      tabValue,
      isFirmwareVerified: isFirmwareVerifiedRef.current,
    });
  }, [
    connectProtocol,
    navigation,
    deviceData,
    getActiveDevice,
    getActiveDeviceFeatures,
    currentDevice,
    tabValue,
  ]);

  // Retry connecting to device after firmware update
  const retryDeviceConnectionAfterUpdate = useCallback(
    async (
      previousDevice: SearchDevice,
      isStale: () => boolean,
      onConnectId: (connectId: string) => void,
    ) => {
      try {
        return await pRetry(
          async (attemptCount) => {
            if (isStale()) {
              // A newer round took over — stop touching the device from this
              // retired reconnect loop instead of burning its retry budget.
              throw new AbortError('stale firmware check round');
            }
            console.log(
              `Attempting to reconnect device after firmware update (attempt ${attemptCount}/11)...`,
            );

            const result = await rebindDeviceAfterFirmwareUpdate(
              previousDevice,
              onConnectId,
            );

            console.log('Device connection successful after firmware update');
            return result.device;
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
        if (!isStale()) {
          console.error(
            'Failed to connect to device after firmware update, all retries exhausted',
            error,
          );
        }

        // No direct step write here — the thrown message reaches the row via
        // checkFirmwareUpdate's guarded catch, which also drops stale rounds.
        throw new OneKeyLocalError(
          intl.formatMessage({
            id: ETranslations.hardware_device_not_find_error,
          }),
        );
      }
    },
    [intl, rebindDeviceAfterFirmwareUpdate],
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
      // A pending post-update reconnect upgrades ANY round — including a
      // manual Retry — to the patient path with its longer watchdog budget.
      const checkAfterUpdate =
        params?.checkAfterUpdate || pendingPostUpdateReconnectRef.current;
      setIsFirmwareRecheckPending(false);
      const cancelTimeout = createStepTimeout(
        isStale,
        () => watchdogConnectId,
        checkAfterUpdate ? POST_UPDATE_STEP_TIMEOUT_MS : STEP_TIMEOUT_MS,
      );
      try {
        await ensureTransportType();
        const baseDevice =
          getActiveDevice() ?? currentDevice ?? deviceData.device;
        if (!baseDevice || (!checkAfterUpdate && !baseDevice.connectId)) {
          setDeviceNotFoundErrorMessageStep();
          return;
        }
        watchdogConnectId = baseDevice.connectId ?? undefined;
        let latestDevice: SearchDevice;
        if (checkAfterUpdate) {
          latestDevice = await retryDeviceConnectionAfterUpdate(
            baseDevice as SearchDevice,
            isStale,
            (connectId) => {
              watchdogConnectId = connectId;
            },
          );
        } else {
          await ensureActiveConnection(baseDevice as SearchDevice);
          latestDevice = (getActiveDevice() ?? baseDevice) as SearchDevice;
        }
        setCurrentDevice(latestDevice);

        if (!latestDevice?.connectId) {
          setDeviceNotFoundErrorMessageStep();
          return;
        }
        const resolvedTransport =
          await backgroundApiProxy.serviceHardware.resolveHardwareTransport({
            connectId: latestDevice.connectId,
            hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
          });
        const compatibleConnectId = resolvedTransport.connectId;
        watchdogConnectId = compatibleConnectId;

        const r =
          await backgroundApiProxy.serviceFirmwareUpdate.checkAllFirmwareRelease(
            {
              connectId: compatibleConnectId,
              skipCancel: true,
              checkFirmwareHash: checkAfterUpdate,
              firmwareType: undefined,
              resolvedTransportType: resolvedTransport.transportType,
            },
          );
        if (isStale()) {
          // A newer retry owns the UI (and the refs feeding DeviceSetup);
          // this late result must not overwrite it.
          return;
        }
        if (r) {
          // The device answered and the check completed — future rounds no
          // longer need the patient post-update reconnect path.
          pendingPostUpdateReconnectRef.current = false;
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
        // The last hardware word of this page's run.
        void endBurst();
      }
    },
    [
      createStepTimeout,
      endBurst,
      ensureTransportType,
      getActiveDevice,
      currentDevice,
      deviceData.device,
      ensureActiveConnection,
      intl,
      retryDeviceConnectionAfterUpdate,
    ],
  );

  const FIRMWARE_RECHECK_DELAY = 10_000; // 10 seconds

  // Refresh the live runtime state after an update succeeds.
  useEffect(() => {
    const handleFirmwareRuntimeChanged = () => {
      console.log('Firmware update runtime changed, recording timestamp...');
      setFirmwareRuntimeChangeTime(Date.now());
      pendingPostUpdateReconnectRef.current = true;
    };

    appEventBus.on(
      EAppEventBusNames.FinishFirmwareUpdate,
      handleFirmwareRuntimeChanged,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.FinishFirmwareUpdate,
        handleFirmwareRuntimeChanged,
      );
    };
  }, []);

  // When page regains focus, check if firmware was updated and recheck if needed
  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await restoreOriginalTransport();
      })();

      const finishTime = firmwareRuntimeChangeTime;
      if (!finishTime) {
        return;
      }
      const firmwareState = firmwareStepStateRef.current;
      if (
        firmwareState === ECheckAndUpdateStepState.Skipped ||
        firmwareState === ECheckAndUpdateStepState.Success ||
        firmwareState === ECheckAndUpdateStepState.InProgress
      ) {
        // Never stomp a user decision (Skipped), a completed result
        // (Success), or an in-flight round (InProgress) on focus regain.
        // Warning stays eligible — the canonical post-update recheck starts
        // from the Warning row the user updated from.
        return;
      }

      setShouldReverifyGenuineAfterUpdate((wasArmed) =>
        keepPostUpdateGenuineRecheckArmed(
          wasArmed,
          genuineStepStateRef.current,
        ),
      );
      setSteps((prev) => armPostUpdateRecheck(prev));

      // Wait for remaining delay (0 if already >= 10s), then recheck firmware.
      // Keep the previous state during this cancellable window so a blur can
      // safely reschedule the check on the next focus. The check owns the
      // InProgress transition when it actually starts.
      cancelFirmwareRecheck();
      setIsFirmwareRecheckPending(true);
      const cancel = createFirmwareRecheckTimer({
        finishTime,
        delayMs: FIRMWARE_RECHECK_DELAY,
        onFire: () => {
          firmwareRecheckCancelRef.current = null;
          setIsFirmwareRecheckPending(false);
          // A user decision may be made between scheduling and firing.
          if (
            firmwareStepStateRef.current === ECheckAndUpdateStepState.Skipped ||
            firmwareStepStateRef.current === ECheckAndUpdateStepState.Success
          ) {
            setFirmwareRuntimeChangeTime(null);
            return;
          }
          // One-shot: consume the timestamp when the recheck actually fires.
          // The patient-path upgrade for later rounds is carried by
          // pendingPostUpdateReconnectRef instead.
          setFirmwareRuntimeChangeTime(null);
          setSteps((prev) => beginPostUpdateRecheck(prev));
          void checkFirmwareUpdate({
            checkAfterUpdate: true,
          });
        },
      });
      firmwareRecheckCancelRef.current = cancel;

      return () => {
        cancel();
        if (firmwareRecheckCancelRef.current === cancel) {
          firmwareRecheckCancelRef.current = null;
        }
      };
    }, [
      cancelFirmwareRecheck,
      checkFirmwareUpdate,
      firmwareRuntimeChangeTime,
      restoreOriginalTransport,
    ]),
  );

  useEffect(() => {
    const unsubscribe = reactNavigation.addListener('beforeRemove', () => {
      // Clean up forceTransportType when leaving this page
      void backgroundApiProxy.serviceHardware.clearForceTransportType();
    });

    return unsubscribe;
  }, [reactNavigation]);

  const runGenuineCheck = useCallback(
    async (checkFirmwareAfterSuccess: boolean) => {
      // Double-check: ensure device scanning is fully stopped before starting verification
      await ensureStopScan();
      await ensureTransportType();
      // One stage for the whole check: the genuine run and the firmware
      // check that follows are one conversation with the device, and the
      // seam between them must not show.
      const burstDevice = (getActiveDevice() ??
        currentDevice ??
        deviceData.device) as SearchDevice | undefined;
      await ensureBurst({
        connectId: burstDevice?.connectId ?? undefined,
        deviceType: burstDevice?.deviceType,
        deviceName: burstDevice?.name ?? undefined,
      });

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
        const verificationDevice =
          getActiveDevice() ?? currentDevice ?? deviceData.device;
        const [result] = await Promise.all([
          verifyHardware(verificationDevice as SearchDevice, tabValue),
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
          if (shouldContinueToFirmwareCheck && checkFirmwareAfterSuccess) {
            newSteps[1] = {
              ...newSteps[1],
              state: ECheckAndUpdateStepState.InProgress,
            };
          }
          return newSteps;
        });
        if (shouldContinueToFirmwareCheck && checkFirmwareAfterSuccess) {
          setTimeout(() => {
            void checkFirmwareUpdate();
          }, 150);
        } else {
          // Nothing follows — the conversation is over, so the stage may go.
          void endBurst();
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
    },
    [
      ensureStopScan,
      ensureTransportType,
      ensureBurst,
      endBurst,
      verifyHardware,
      deviceData.device,
      tabValue,
      intl,
      checkFirmwareUpdate,
      getActiveDevice,
      currentDevice,
    ],
  );

  const handleVerifyHardware = useCallback(async () => {
    if (isAnyStepInProgress) {
      return;
    }
    await runGenuineCheck(true);
  }, [isAnyStepInProgress, runGenuineCheck]);

  useEffect(() => {
    if (
      !shouldReverifyGenuineAfterUpdate ||
      !isCheckAndUpdateStepAccepted(firmwareStepState)
    ) {
      return;
    }

    setShouldReverifyGenuineAfterUpdate(false);
    void runGenuineCheck(false);
  }, [firmwareStepState, runGenuineCheck, shouldReverifyGenuineAfterUpdate]);

  const handleRetry = useCallback(async () => {
    if (isAnyStepInProgress) {
      return;
    }
    const currentErrorStep = steps.find(
      (step) => step.state === ECheckAndUpdateStepState.Error,
    );
    if (!currentErrorStep) {
      await handleVerifyHardware();
      return;
    }
    if (currentErrorStep.id === ECheckAndUpdateStepId.GenuineCheck) {
      await runGenuineCheck(!isCheckAndUpdateStepAccepted(firmwareStepState));
    } else if (currentErrorStep.id === ECheckAndUpdateStepId.FirmwareCheck) {
      await checkFirmwareUpdate();
    }
  }, [
    checkFirmwareUpdate,
    firmwareStepState,
    handleVerifyHardware,
    isAnyStepInProgress,
    runGenuineCheck,
    steps,
  ]);

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
              // Skipping also cancels any pending focus-effect auto-recheck.
              cancelFirmwareRecheck();
              setIsFirmwareRecheckPending(false);
              setFirmwareRuntimeChangeTime(null);
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
  }, [cancelFirmwareRecheck, intl]);

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
    // Skipping also cancels any pending focus-effect auto-recheck.
    cancelFirmwareRecheck();
    setIsFirmwareRecheckPending(false);
    setFirmwareRuntimeChangeTime(null);
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
  }, [cancelFirmwareRecheck, checkFirmwareUpdate]);

  // Primary CTA at the foot of the flow. The two states are mutually exclusive
  // (all-idle → verify the device; ready → continue to setup), so the single
  // bottom slot renders whichever is active.
  let bottomCta: {
    key: string;
    testID: string;
    onPress: () => void;
    label: string;
  } | null = null;
  if (
    !isAnyStepInProgress &&
    !steps.some((step) => step.state !== ECheckAndUpdateStepState.Idle)
  ) {
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
      <BootloaderDialogHostBridge ref={bootloaderDialogHostRef} />
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
                  id: ETranslations.global_skip,
                })
              : intl.formatMessage({
                  id: ETranslations.global_skip,
                });
        }
        const isFirmwareRecheckWaiting =
          step.id === ECheckAndUpdateStepId.FirmwareCheck &&
          isFirmwareRecheckPending;
        let displayDescription = isStepCollapsed ? undefined : step.description;
        if (isFirmwareRecheckWaiting) {
          displayDescription = intl.formatMessage({
            id: ETranslations.update_checking_device_if_no_restart,
          });
        }
        return (
          <YStack key={step.title}>
            {/* highlight background */}
            <AnimatePresence>
              {step.state &&
              !isStepCollapsed &&
              step.state !== ECheckAndUpdateStepState.Idle ? (
                <YStack
                  transition="quick"
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
                beaming={
                  step.state === ECheckAndUpdateStepState.InProgress ||
                  isFirmwareRecheckWaiting
                }
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
              step.state === ECheckAndUpdateStepState.Warning &&
              !isFirmwareRecheckPending ? (
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
                      disabled={isAnyStepInProgress}
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
            transition="quick"
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

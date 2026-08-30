import { useCallback } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import type {
  IDeviceVerifyVersionCompareResult,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';
import type {
  IDeviceStageAuthChecklistItem,
  IDeviceStageAuthFailureReasonValue,
} from '@onekeyhq/shared/types/deviceStage';

import type { SearchDevice } from '@onekeyfe/hd-core';

/**
 * The authenticity check, played on the DeviceStage (OK-59934) instead of
 * the legacy multi-state dialog.
 *
 * The sequence itself is unchanged — it is the same three bg calls the
 * dialog made — but the beats land on the stage, so the check no longer
 * needs a surface of its own inside a flow that already has one.
 * The card's exits come back over the app event bus, since the stage is a
 * single global driver and the run is per call site.
 */

/** The server's answer that verification is momentarily unavailable
 * rather than a verdict on the device (device-checking codes). */
const SERVER_CODE_NETWORK = 10_104;
const SERVER_CODES_UNAVAILABLE = new Set([10_105, 10_106, 10_107]);

/** Errors that mean the person (or the app) ended the run — the check
 * simply stops, no failure card. */
const SILENT_CODES = new Set<unknown>([
  HardwareErrorCode.ActionCancelled,
  HardwareErrorCode.CallQueueActionCancelled,
  HardwareErrorCode.PinCancelled,
  HardwareErrorCode.NewFirmwareForceUpdate,
  HardwareErrorCode.BleUnavailableWhileUsbConnected,
]);

export type IDeviceStageFirmwareVerifyParams = {
  device: SearchDevice | IDBDevice;
  features: IOneKeyDeviceFeatures | undefined;
  skipDeviceCancel?: boolean;
};

export type IDeviceStageFirmwareVerifyResult = {
  /** True when the device verified as official; false when the person
   * continued unverified. */
  checked: boolean;
  /** The run ended without a verdict — cancelled, or the flow moved on. */
  closed?: boolean;
};

function rowsAtCertificate({
  labels,
  status,
  value,
  url,
}: {
  labels: string[];
  status: IDeviceStageAuthChecklistItem['status'];
  value?: string;
  url?: string;
}): IDeviceStageAuthChecklistItem[] {
  return [
    { label: labels[0], status, value, url },
    // The certificate landing is also what starts the firmware row — the
    // legacy dialog moved them together and the timing reads right.
    { label: labels[1], status: status === 'ok' ? 'loading' : 'pending' },
    { label: labels[2], status: 'pending' },
    { label: labels[3], status: 'pending' },
  ];
}

export function useDeviceStageFirmwareVerify() {
  const intl = useIntl();

  const runDeviceStageFirmwareVerify = useCallback(
    async ({
      device,
      features,
      skipDeviceCancel = true,
    }: IDeviceStageFirmwareVerifyParams): Promise<IDeviceStageFirmwareVerifyResult> => {
      const { serviceHardware, serviceHardwareUI } = backgroundApiProxy;
      const connectId = device.connectId ?? '';
      const labels = [
        intl.formatMessage({ id: ETranslations.device_auth_certificate }),
        intl.formatMessage({ id: ETranslations.global_firmware }),
        intl.formatMessage({ id: ETranslations.global_bluetooth }),
        'Bootloader',
      ];

      // The run holds its own burst layer (depth-stacked), begun before
      // the first beat: a wrapper opening at depth 1 wipes the narrative
      // and paints `connecting` over the genuine-check card in entries
      // nothing else holds (device settings → authenticity check), and
      // with nothing holding, the failure card is left with no exit at
      // all. Inside onboarding's flow-held burst this layer simply nests.
      await serviceHardwareUI.deviceStageJoinBurst({
        connectId,
        deviceType: device.deviceType,
        deviceName: device.name,
      });
      try {
        // Whether the server recognizes this exact version triple decides
        // between the per-component checklist and the single wait.
        let useNewProcess = false;
        try {
          useNewProcess =
            await serviceHardware.shouldAuthenticateFirmwareByHash({
              features,
            });
        } catch {
          useNewProcess = false;
        }

        const noteStep = async (
          step:
            | 'genuineCheck'
            | 'authVerifying'
            | 'authSuccess'
            | 'authFailure',
          extras?: {
            checklist?: IDeviceStageAuthChecklistItem[];
            failureReason?: IDeviceStageAuthFailureReasonValue;
          },
        ) => {
          await serviceHardwareUI.deviceStageNoteAuthStep({
            step,
            connectId,
            checklist: extras?.checklist,
            failureReason: extras?.failureReason,
          });
        };

        const rowsFromCompare = (
          compare: IDeviceVerifyVersionCompareResult,
          certificateValue?: string,
        ): IDeviceStageAuthChecklistItem[] =>
          (['certificate', 'firmware', 'bluetooth', 'bootloader'] as const).map(
            (key, index) => {
              const entry = compare[key] as
                | { isMatch: boolean; format?: string; releaseUrl?: string }
                | undefined;
              if (key === 'certificate') {
                return {
                  label: labels[0],
                  status: 'ok',
                  value: certificateValue,
                };
              }
              if (!entry) {
                return { label: labels[index], status: 'pending' };
              }
              return {
                label: labels[index],
                status: entry.isMatch ? 'ok' : 'failed',
                value: entry.format,
                url: entry.releaseUrl,
              };
            },
          );

        // One run of the check. `failed` leaves a card standing and waits
        // for its exit; `aborted` means the run ended with no card at all
        // (cancelled, forced firmware update) and nothing is waiting.
        type IRunOutcome = 'verified' | 'failed' | 'aborted';
        const runOnce = async (): Promise<IRunOutcome> => {
          // The device asks for a confirmation first; the wait begins when
          // it is given (the bg announces that moment).
          const onDeviceConfirmed = () => {
            void noteStep('authVerifying');
          };
          appEventBus.on(
            EAppEventBusNames.HardwareVerifyAfterDeviceConfirm,
            onDeviceConfirmed,
          );
          await noteStep('genuineCheck');
          try {
            const authResult = await serviceHardware.firmwareAuthenticate({
              device,
              skipDeviceCancel,
            });
            const certificateValue = authResult.result?.data ?? '';
            if (!authResult.verified) {
              const code = authResult.result?.code;
              let reason: IDeviceStageAuthFailureReasonValue =
                'unofficialDevice';
              if (code === SERVER_CODE_NETWORK) {
                reason = 'network';
              } else if (
                code !== undefined &&
                SERVER_CODES_UNAVAILABLE.has(code)
              ) {
                reason = 'unavailable';
              }
              await noteStep('authFailure', { failureReason: reason });
              return 'failed';
            }

            if (!useNewProcess) {
              await noteStep('authSuccess');
              return 'verified';
            }

            await noteStep('authVerifying', {
              checklist: rowsAtCertificate({
                labels,
                status: 'ok',
                value: certificateValue,
              }),
            });
            const latestFeatures =
              await serviceHardware.getFirmwareVerificationFeatures({
                connectId,
                deviceType: device.deviceType,
              });
            const compare = await serviceHardware.verifyFirmwareHash({
              deviceType: device.deviceType,
              onekeyFeatures: latestFeatures,
            });
            const checklist = rowsFromCompare(compare, certificateValue);
            const hasUnverified = checklist.some(
              (row) => row.status === 'failed',
            );
            if (hasUnverified) {
              await noteStep('authFailure', {
                checklist,
                failureReason: 'unofficialFirmware',
              });
              return 'failed';
            }
            await noteStep('authSuccess', { checklist });
            return 'verified';
          } catch (error) {
            const err = error as IOneKeyError;
            if (SILENT_CODES.has(err?.code)) {
              return 'aborted';
            }
            // A wrong PIN fails the unlock, not the authenticity check — no
            // verdict was reached. It lands as the stage's own error notice
            // (accurate words, self-dismissing), never as an authFailure.
            if (err?.code === HardwareErrorCode.PinInvalid) {
              await serviceHardwareUI.deviceStageNoteError({
                connectId,
                errorReason: 'pinInvalid',
              });
              return 'aborted';
            }
            let reason: IDeviceStageAuthFailureReasonValue = 'unknown';
            if (
              err?.className === EOneKeyErrorClassNames.OneKeyServerApiError
            ) {
              reason = 'unknown';
            } else if (
              err?.code === HardwareErrorCode.NetworkError ||
              err?.code === HardwareErrorCode.BridgeNetworkError ||
              (err?.code as unknown) === 'ERR_NETWORK'
            ) {
              reason = 'network';
            } else if (err?.code === HardwareErrorCode.DefectiveFirmware) {
              reason = 'defective';
            } else if (
              err?.code === HardwareErrorCode.NotAllowInBootloaderMode
            ) {
              reason = 'unofficialDevice';
            }
            await noteStep('authFailure', { failureReason: reason });
            return 'failed';
          } finally {
            appEventBus.off(
              EAppEventBusNames.HardwareVerifyAfterDeviceConfirm,
              onDeviceConfirmed,
            );
            await serviceHardwareUI.closeHardwareUiStateDialog({
              connectId,
              skipDeviceCancel,
            });
          }
        };

        // The failure card's exits decide what happens next: Retry runs the
        // whole check again (a fresh device confirmation included), Continue
        // anyway proceeds unverified, Support opens the help channel and
        // leaves the card standing.
        for (;;) {
          const outcome = await runOnce();
          if (outcome === 'verified') {
            return { checked: true };
          }
          if (outcome === 'aborted') {
            return { checked: false, closed: true };
          }
          const action = await new Promise<
            'retry' | 'support' | 'continueAnyway' | 'closed'
          >((resolve) => {
            // Reassigned once both handlers exist — each exit path must
            // release BOTH listeners (the manual-close one used to leak).
            let cleanup = () => {};
            const onAction = ({
              action: next,
            }: {
              action: 'retry' | 'support' | 'continueAnyway';
            }) => {
              if (next === 'support') {
                void showIntercom();
                return;
              }
              cleanup();
              resolve(next);
            };
            // The person dismissing the stage ends the run just as well.
            const onStageClosed = () => {
              cleanup();
              resolve('closed');
            };
            cleanup = () => {
              appEventBus.off(
                EAppEventBusNames.DeviceStageAuthAction,
                onAction,
              );
              appEventBus.off(
                EAppEventBusNames.CloseHardwareUiStateDialogManually,
                onStageClosed,
              );
            };
            appEventBus.on(EAppEventBusNames.DeviceStageAuthAction, onAction);
            appEventBus.on(
              EAppEventBusNames.CloseHardwareUiStateDialogManually,
              onStageClosed,
            );
          });
          if (action === 'continueAnyway') {
            // The confirmation is the narrative's ending (Stage 4, 2a):
            // retire it, or every later call-end close re-pins the failure
            // card over whatever the flow does next.
            await serviceHardwareUI.deviceStageNoteAuthResolved();
            return { checked: false };
          }
          if (action === 'closed') {
            return { checked: false, closed: true };
          }
        }
      } finally {
        await serviceHardwareUI.deviceStageLeaveBurst();
      }
    },
    [intl],
  );

  return { runDeviceStageFirmwareVerify };
}

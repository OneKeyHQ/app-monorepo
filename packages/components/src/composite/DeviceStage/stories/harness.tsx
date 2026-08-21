import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useWindowDimensions } from 'react-native';

import { DeviceStage } from '@onekeyhq/components/src/composite/DeviceStage';
import type {
  IAuthChecklistItem,
  IDeviceStageProps,
  IDeviceStageStep,
} from '@onekeyhq/components/src/composite/DeviceStage';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { Stack, XStack } from '@onekeyhq/components/src/primitives/Stack';

/**
 * The stage stories' shared scaffolding: one demo state machine (the
 * driver — every button is something the device or the SDK could say
 * next, pressable in any order), one host that parks the buttons above
 * the portal-mounted stage, and the step button that lights up while
 * its step is on. Each story file picks the buttons of its own flow
 * family; the Console story runs the whole vocabulary for mid-flight
 * flips across families.
 */

/* The authenticity demo's checklist data, the design's own example rows.
 * The certificate row shows the device serial (no link); the firmware
 * rows show version (hash) and link to the public release page. */
const AUTH_ROW_LABELS = [
  'Certificate',
  'Firmware',
  'Bluetooth',
  'Bootloader',
] as const;
const AUTH_ROW_VALUES = [
  'PRB09B0088A',
  '4.0.0 (2c4d945-ff9efe5)',
  '2.1.0 (deaf294-5206e9d)',
  '2.2.0 (8a5b950-2bbd01c)',
];
const AUTH_RELEASE_URL = 'https://github.com/OneKeyHQ/firmware/releases';
const AUTH_STEP_MS = 900;

function authRowAt(
  index: number,
  status: IAuthChecklistItem['status'],
): IAuthChecklistItem {
  return {
    label: AUTH_ROW_LABELS[index],
    status,
    ...(status === 'ok'
      ? {
          value: AUTH_ROW_VALUES[index],
          ...(index > 0 ? { url: AUTH_RELEASE_URL } : {}),
        }
      : {}),
  };
}

function authRowsAtProgress(progress: number): IAuthChecklistItem[] {
  return AUTH_ROW_LABELS.map((_, index) => {
    if (index < progress) return authRowAt(index, 'ok');
    if (index === progress) return authRowAt(index, 'loading');
    return authRowAt(index, 'pending');
  });
}

export interface IStageDriver {
  step: IDeviceStageStep;
  /** Plain step change: clears timers and the inline error. */
  go: (next: IDeviceStageStep) => void;
  /** The device refusing the entry: back to the pad, error line in place. */
  wrongPin: () => void;
  /** The authenticity ask, checklist cleared for a fresh run. */
  goGenuineCheck: () => void;
  /** The legacy single-check wait (no checklist). */
  goAuthVerifying: () => void;
  /** The checklist demo: rows advance on a timer the way the real
   * verification reports — certificate first, then each firmware hash —
   * and the flow lands on success by itself. */
  startAuthChecklist: () => void;
  /** The landing: keeps an all-green list when rows are in play,
   * otherwise the legacy checklist-less shape. */
  goAuthSuccess: () => void;
  /** The failure, rows marked for the unofficial-firmware reason. */
  goAuthFailure: () => void;
  /** Everything wired: spread onto <DeviceStage/> after the story args. */
  stageProps: Partial<IDeviceStageProps>;
}

export function useStageDriver(
  props: Pick<IDeviceStageProps, 'errorReason' | 'authFailureReason'>,
): IStageDriver {
  const { errorReason, authFailureReason } = props;
  const [step, setStep] = useState<IDeviceStageStep>('off');
  const [inputError, setInputError] = useState<string | undefined>(undefined);
  const [authRows, setAuthRows] = useState<IAuthChecklistItem[] | undefined>(
    undefined,
  );
  const authTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearAuthTimers = useCallback(() => {
    authTimersRef.current.forEach(clearTimeout);
    authTimersRef.current = [];
  }, []);
  useEffect(() => clearAuthTimers, [clearAuthTimers]);
  const go = useCallback(
    (next: IDeviceStageStep) => {
      clearAuthTimers();
      setInputError(undefined);
      setStep(next);
    },
    [clearAuthTimers],
  );
  const wrongPin = useCallback(() => {
    setInputError('Wrong PIN. Try again.');
    setStep('pinOnApp');
  }, []);
  const handlePinSubmit = useCallback(() => go('processing'), [go]);
  const handlePassphraseSubmit = useCallback(() => go('processing'), [go]);
  const handlePassphraseAttachPin = useCallback(() => go('enterPin'), [go]);
  // The intro read and confirmed: on to the entry itself (create-flavored
  // in the real flow; the demo leaves the mode to its control).
  const handlePassphraseIntroContinue = useCallback(
    () => go('passphraseOnApp'),
    [go],
  );
  const handleSwitchToDevice = useCallback(() => {
    setInputError(undefined);
    setStep((current) =>
      current === 'passphraseOnApp' ? 'enterPassphrase' : 'enterPin',
    );
  }, []);
  const handleQrNext = useCallback(() => go('scanQr'), [go]);
  const handleQrBack = useCallback(() => go('showQr'), [go]);
  const handleErrorAction = useCallback(() => {
    go(errorReason === 'pinInvalid' ? 'pinOnApp' : 'connecting');
  }, [errorReason, go]);
  const goGenuineCheck = useCallback(() => {
    setAuthRows(undefined);
    go('genuineCheck');
  }, [go]);
  const goAuthVerifying = useCallback(() => {
    setAuthRows(undefined);
    go('authVerifying');
  }, [go]);
  const startAuthChecklist = useCallback(() => {
    go('authVerifying');
    setAuthRows(authRowsAtProgress(0));
    [1, 2, 3].forEach((progress) => {
      authTimersRef.current.push(
        setTimeout(
          () => setAuthRows(authRowsAtProgress(progress)),
          AUTH_STEP_MS * progress,
        ),
      );
    });
    authTimersRef.current.push(
      setTimeout(
        () => setAuthRows(AUTH_ROW_LABELS.map((_, i) => authRowAt(i, 'ok'))),
        AUTH_STEP_MS * 4,
      ),
    );
    authTimersRef.current.push(
      setTimeout(() => setStep('authSuccess'), AUTH_STEP_MS * 4 + 700),
    );
  }, [go]);
  const goAuthSuccess = useCallback(() => {
    setAuthRows((rows) =>
      rows ? AUTH_ROW_LABELS.map((_, i) => authRowAt(i, 'ok')) : undefined,
    );
    go('authSuccess');
  }, [go]);
  const goAuthFailure = useCallback(() => {
    setAuthRows(
      authFailureReason === 'unofficialFirmware'
        ? AUTH_ROW_LABELS.map((_, i) =>
            i === 2 ? authRowAt(i, 'failed') : authRowAt(i, 'ok'),
          )
        : undefined,
    );
    go('authFailure');
  }, [authFailureReason, go]);
  const handleAuthSupport = useCallback(() => {}, []);
  const handleAuthContinueAnyway = useCallback(() => go('off'), [go]);
  return {
    step,
    go,
    wrongPin,
    goGenuineCheck,
    goAuthVerifying,
    startAuthChecklist,
    goAuthSuccess,
    goAuthFailure,
    stageProps: {
      step,
      inputError,
      authChecklist: authRows,
      onAuthSupport: handleAuthSupport,
      onAuthRetry: startAuthChecklist,
      onAuthContinueAnyway: handleAuthContinueAnyway,
      onPinSubmit: handlePinSubmit,
      onPassphraseIntroContinue: handlePassphraseIntroContinue,
      onPassphraseSubmit: handlePassphraseSubmit,
      onPassphraseAttachPin: handlePassphraseAttachPin,
      onSwitchToDevice: handleSwitchToDevice,
      onQrNext: handleQrNext,
      onQrBack: handleQrBack,
      onErrorAction: handleErrorAction,
    },
  };
}

/** One driver button: lights primary while its step is on; a custom
 * onPress (row scripts, refusals) still wears its step's light. */
export function StepButton({
  driver,
  step,
  onPress,
  testID,
  children,
}: {
  driver: IStageDriver;
  step?: IDeviceStageStep;
  onPress?: () => void;
  /** Buttons without a step (refusals, scripts) name themselves. */
  testID?: string;
  children: ReactNode;
}) {
  const { go } = driver;
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    if (step) {
      go(step);
    }
  }, [go, onPress, step]);
  return (
    <Button
      testID={testID ?? `device-stage-demo-${step ?? 'action'}`}
      variant={step && driver.step === step ? 'primary' : undefined}
      onPress={handlePress}
    >
      {children}
    </Button>
  );
}

/** The demo host: the stage portals to the shell's canvas-wide mount
 * (the hardware-dialog level) on every platform; this holds the buttons,
 * and its minHeight (window minus a workbench-chrome allowance) keeps
 * the canvas — and so that mount — tall enough for the stage to anchor
 * to the bottom. */
export function StageHost({
  driver,
  props,
  children,
}: {
  driver: IStageDriver;
  props: IDeviceStageProps;
  children: ReactNode;
}) {
  const { height } = useWindowDimensions();
  return (
    <Stack minHeight={height - 190}>
      <XStack gap="$2" flexWrap="wrap">
        {children}
      </XStack>
      <DeviceStage {...props} {...driver.stageProps} />
    </Stack>
  );
}

/** The shared demo payloads and control shapes each family picks from. */
export const DEMO = {
  deviceName: 'Pro 062B',
  confirmContext: 'Description here...',
  confirmDetails: [
    {
      label: 'Address',
      value: '0x627Ddbef61C811af05288Cd79db324fCac914AeF',
      highlightEnds: true,
    },
  ],
  qrValue: '0x627Ddbef61C811af05288Cd79db324fCac914AeF',
};

export const ARG_TYPES = {
  // Owned by the demo's buttons, not by controls.
  step: { table: { disable: true } },
  deviceType: {
    control: 'inline-radio',
    options: ['classic', 'pro', 'slate'],
  },
  passphraseMode: {
    control: 'inline-radio',
    options: ['create', 'verify'],
  },
  errorReason: {
    control: 'inline-radio',
    options: ['rejected', 'pinInvalid', 'disconnected', 'busy'],
  },
  authFailureReason: {
    control: 'inline-radio',
    options: [
      'unofficialDevice',
      'unofficialFirmware',
      'defective',
      'network',
      'unknown',
      'unavailable',
    ],
  },
  qrValue: { control: 'text' },
} as const;

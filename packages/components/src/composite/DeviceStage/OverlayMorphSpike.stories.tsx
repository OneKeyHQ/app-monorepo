import type { ComponentProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useWindowDimensions } from 'react-native';

import type { IDeviceStageOverlayStep } from '@onekeyhq/components/src/composite/DeviceStage/OverlayMorphSpike';
import { DeviceStageOverlaySpike } from '@onekeyhq/components/src/composite/DeviceStage/OverlayMorphSpike';
import type { IAuthChecklistItem } from '@onekeyhq/components/src/composite/DeviceStage/type';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { Stack, XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// The overlay engine's event console, mirroring the sheet stage's FlowDemo:
// every button is something the device or the SDK could say next, pressable
// in any order. Waiting beats rest as the floating capsule; asks bloom into
// the card — the breathing is the point, so flip between the two classes
// (and inside the card class) freely, including mid-flight. Presence is out
// of scope, so the overlay is simply always there, resting at `off`.

const meta = {
  title: 'Composite/DeviceStageOverlaySpike',
  component: DeviceStageOverlaySpike,
  args: {
    step: 'off',
    deviceType: 'slate',
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
    // The flow spec's plain entry shape; flip to 'create' for the
    // Add-hidden-wallet titling and its empty-entry refusal.
    passphraseMode: 'verify',
    errorReason: 'rejected',
    authFailureReason: 'unofficialDevice',
  },
  argTypes: {
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
  },
} satisfies Meta<typeof DeviceStageOverlaySpike>;

export default meta;

type Story = StoryObj<typeof meta>;

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

function MorphFlowStage(props: ComponentProps<typeof DeviceStageOverlaySpike>) {
  const { deviceType, errorReason, authFailureReason } = props;
  const [step, setStep] = useState<IDeviceStageOverlayStep>('off');
  const [inputError, setInputError] = useState<string | undefined>(undefined);
  const [authRows, setAuthRows] = useState<IAuthChecklistItem[] | undefined>(
    undefined,
  );
  const { height } = useWindowDimensions();
  const authTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearAuthTimers = useCallback(() => {
    authTimersRef.current.forEach(clearTimeout);
    authTimersRef.current = [];
  }, []);
  useEffect(() => clearAuthTimers, [clearAuthTimers]);
  const go = useCallback(
    (next: IDeviceStageOverlayStep) => {
      clearAuthTimers();
      setInputError(undefined);
      setStep(next);
    },
    [clearAuthTimers],
  );
  const handleConnecting = useCallback(() => go('connecting'), [go]);
  const handleEnterPin = useCallback(() => go('enterPin'), [go]);
  const handlePinOnApp = useCallback(() => go('pinOnApp'), [go]);
  const handlePassphraseIntro = useCallback(() => go('passphraseIntro'), [go]);
  const handleEnterPassphrase = useCallback(() => go('enterPassphrase'), [go]);
  const handlePassphraseOnApp = useCallback(() => go('passphraseOnApp'), [go]);
  // The intro read and confirmed: on to the entry itself (create-flavored
  // in the real flow; the console leaves the mode to its control).
  const handlePassphraseIntroContinue = useCallback(
    () => go('passphraseOnApp'),
    [go],
  );
  const handleConfirm = useCallback(() => go('confirm'), [go]);
  const handleShowQr = useCallback(() => go('showQr'), [go]);
  const handleScanQr = useCallback(() => go('scanQr'), [go]);
  const handleQrNext = useCallback(() => go('scanQr'), [go]);
  const handleQrBack = useCallback(() => go('showQr'), [go]);
  const handleProcessing = useCallback(() => go('processing'), [go]);
  const handleError = useCallback(() => go('error'), [go]);
  const handleOff = useCallback(() => go('off'), [go]);
  // The device refusing the entry: back to the pad, error line in place.
  const handleWrongPin = useCallback(() => {
    setInputError('Wrong PIN. Try again.');
    setStep('pinOnApp');
  }, []);
  const handlePinSubmit = useCallback(() => go('processing'), [go]);
  const handlePassphraseSubmit = useCallback(() => go('processing'), [go]);
  const handlePassphraseAttachPin = useCallback(() => go('enterPin'), [go]);
  const handleSwitchToDevice = useCallback(() => {
    setInputError(undefined);
    setStep((current) =>
      current === 'passphraseOnApp' ? 'enterPassphrase' : 'enterPin',
    );
  }, []);
  const handleErrorAction = useCallback(() => {
    go(errorReason === 'pinInvalid' ? 'pinOnApp' : 'connecting');
  }, [errorReason, go]);
  const handleGenuineCheck = useCallback(() => {
    setAuthRows(undefined);
    go('genuineCheck');
  }, [go]);
  const handleAuthVerifyingPlain = useCallback(() => {
    setAuthRows(undefined);
    go('authVerifying');
  }, [go]);
  // The checklist demo: rows advance on a timer the way the real
  // verification reports — certificate first, then each firmware hash —
  // and the flow lands on success by itself.
  const handleAuthVerifyingChecklist = useCallback(() => {
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
  const handleAuthSuccess = useCallback(() => {
    // With rows in play the landing keeps the all-green list; without,
    // it plays the legacy checklist-less shape.
    setAuthRows((rows) =>
      rows ? AUTH_ROW_LABELS.map((_, i) => authRowAt(i, 'ok')) : undefined,
    );
    go('authSuccess');
  }, [go]);
  const handleAuthFailure = useCallback(() => {
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
  return (
    // The overlay portals to the shell's canvas-wide mount (the
    // hardware-dialog level) on every platform; this host holds the
    // buttons, and its minHeight (window minus a workbench-chrome
    // allowance) keeps the canvas — and so that mount — tall enough for
    // the stage to anchor to the bottom.
    <Stack minHeight={height - 190}>
      <XStack gap="$2" flexWrap="wrap">
        <Button
          variant={step === 'off' ? 'primary' : undefined}
          onPress={handleOff}
        >
          Off
        </Button>
        <Button
          variant={step === 'connecting' ? 'primary' : undefined}
          onPress={handleConnecting}
        >
          Connecting
        </Button>
        <Button
          variant={step === 'enterPin' ? 'primary' : undefined}
          onPress={handleEnterPin}
        >
          PIN on device
        </Button>
        <Button
          variant={step === 'pinOnApp' ? 'primary' : undefined}
          onPress={handlePinOnApp}
        >
          PIN in app
        </Button>
        <Button onPress={handleWrongPin}>Wrong PIN</Button>
        <Button
          variant={step === 'passphraseIntro' ? 'primary' : undefined}
          onPress={handlePassphraseIntro}
        >
          Hidden wallet intro
        </Button>
        <Button
          variant={step === 'enterPassphrase' ? 'primary' : undefined}
          onPress={handleEnterPassphrase}
        >
          Passphrase on device
        </Button>
        <Button
          variant={step === 'passphraseOnApp' ? 'primary' : undefined}
          onPress={handlePassphraseOnApp}
        >
          Passphrase in app
        </Button>
        <Button
          variant={step === 'confirm' ? 'primary' : undefined}
          onPress={handleConfirm}
        >
          Confirm
        </Button>
        <Button
          variant={step === 'showQr' ? 'primary' : undefined}
          onPress={handleShowQr}
        >
          Show QR
        </Button>
        <Button
          variant={step === 'scanQr' ? 'primary' : undefined}
          onPress={handleScanQr}
        >
          Scan QR
        </Button>
        <Button
          variant={step === 'processing' ? 'primary' : undefined}
          onPress={handleProcessing}
        >
          Processing
        </Button>
        <Button
          variant={step === 'error' ? 'primary' : undefined}
          onPress={handleError}
        >
          Error
        </Button>
        <Button
          variant={step === 'genuineCheck' ? 'primary' : undefined}
          onPress={handleGenuineCheck}
        >
          Genuine check
        </Button>
        <Button
          variant={step === 'authVerifying' ? 'primary' : undefined}
          onPress={handleAuthVerifyingPlain}
        >
          Verifying
        </Button>
        <Button onPress={handleAuthVerifyingChecklist}>
          Verifying · checklist
        </Button>
        <Button
          variant={step === 'authSuccess' ? 'primary' : undefined}
          onPress={handleAuthSuccess}
        >
          Verify success
        </Button>
        <Button
          variant={step === 'authFailure' ? 'primary' : undefined}
          onPress={handleAuthFailure}
        >
          Auth failure
        </Button>
      </XStack>
      <DeviceStageOverlaySpike
        {...props}
        step={step}
        deviceType={deviceType}
        inputError={inputError}
        authChecklist={authRows}
        onAuthSupport={handleAuthSupport}
        onAuthRetry={handleAuthVerifyingChecklist}
        onAuthContinueAnyway={handleAuthContinueAnyway}
        onPinSubmit={handlePinSubmit}
        onPassphraseIntroContinue={handlePassphraseIntroContinue}
        onPassphraseSubmit={handlePassphraseSubmit}
        onPassphraseAttachPin={handlePassphraseAttachPin}
        onSwitchToDevice={handleSwitchToDevice}
        onQrNext={handleQrNext}
        onQrBack={handleQrBack}
        onErrorAction={handleErrorAction}
      />
    </Stack>
  );
}

/**
 * The full vocabulary on the morphing container. Waiting beats (Off,
 * Connecting, Processing) rest as the capsule; every ask blooms into the
 * card at its own measured height. Springs re-aim from wherever they are,
 * so mid-flight flips are part of the demo.
 */
export const MorphFlow: Story = {
  render: MorphFlowStage,
};

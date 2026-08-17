import type { ComponentProps } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { fn } from 'storybook/test';

import { DeviceStage } from '@onekeyhq/components/src/composite/DeviceStage';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

type IStageStep = ComponentProps<typeof DeviceStage>['step'];

// One dialog per hardware burst, content swapped in place — the point of the
// module is that consecutive device requests never close and reopen the
// surface, endings included: failure and completion land on the same stage
// instead of a toast or a second dialog. There is no fixed sequence in the
// real app — the device drives — so FlowDemo is a console of events, not a
// script: each button is something the device (or the SDK) could say next,
// pressable in any order.
//
// The stage is a fixed dark theater (the Wallet treatment): an opaque
// near-black face whatever the shell theme. The shell theme only changes the
// app behind the sheet.

/** The ratified landing beat: under a second, then the driver closes. */
const SUCCESS_BEAT_MS = 900;

const meta = {
  title: 'Composite/DeviceStage',
  component: DeviceStage,
  args: {
    // Visibility and step are owned by the demo wrapper, not by controls.
    open: false,
    onOpenChange: fn(),
    step: 'off',
    deviceType: 'slate',
    confirmContext: 'Send 0.1 ETH to 0x1234…abcd',
    confirmDetails: [
      {
        label: 'Address',
        value: '0x627Ddbef61C811af05288Cd79db324fCac914AeF',
        highlightEnds: true,
      },
    ],
    qrValue: '0x627Ddbef61C811af05288Cd79db324fCac914AeF',
    passphraseMode: 'create',
    errorReason: 'rejected',
    locked: false,
  },
  argTypes: {
    open: { table: { disable: true } },
    onOpenChange: { table: { disable: true } },
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
    qrValue: { control: 'text' },
    locked: { control: 'boolean' },
  },
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

/* Manual drive of the burst. The buttons live at the top of the host
 * screen, not in the dialog; backgroundInteractive keeps them pressable
 * while the sheet is up — a native-only capability, so on web the modal
 * backdrop covers them once the stage is presented. Every step button
 * also presents the sheet, so any state is one press away from cold;
 * closing resets to dark. */
function FlowDemoStage(props: ComponentProps<typeof DeviceStage>) {
  const { errorReason } = props;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<IStageStep>('off');
  const [inputError, setInputError] = useState<string | undefined>(undefined);
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setInputError(undefined);
      setStep('off');
    }
  }, []);
  const go = useCallback((next: IStageStep) => {
    setInputError(undefined);
    setStep(next);
    setOpen(true);
  }, []);
  const handleConnecting = useCallback(() => go('connecting'), [go]);
  const handleEnterPin = useCallback(() => go('enterPin'), [go]);
  const handlePinOnApp = useCallback(() => go('pinOnApp'), [go]);
  const handleEnterPassphrase = useCallback(() => go('enterPassphrase'), [go]);
  const handlePassphraseOnApp = useCallback(() => go('passphraseOnApp'), [go]);
  const handleConfirm = useCallback(() => go('confirm'), [go]);
  const handleShowQr = useCallback(() => go('showQr'), [go]);
  const handleScanQr = useCallback(() => go('scanQr'), [go]);
  // The air-gap handoff: the person saw the device finish, so they move on.
  const handleQrNext = useCallback(() => go('scanQr'), [go]);
  // And its escape hatch: back to the code if the device never got it.
  const handleQrBack = useCallback(() => go('showQr'), [go]);
  const handleProcessing = useCallback(() => go('processing'), [go]);
  const handleError = useCallback(() => go('error'), [go]);
  const handleSuccess = useCallback(() => go('success'), [go]);
  // The device refusing the entry: back to the pad, error line in place,
  // typed value cleared — retry where the person already is.
  const handleWrongPin = useCallback(() => {
    setInputError('Wrong PIN. Try again.');
    setStep('pinOnApp');
    setOpen(true);
  }, []);
  const handlePinSubmit = useCallback(() => go('processing'), [go]);
  const handlePassphraseSubmit = useCallback(() => go('processing'), [go]);
  // The attach-PIN path: entering the hidden wallet's PIN on the device.
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
  // Success is a beat, not a state to sit in: the driver closes it.
  useEffect(() => {
    if (step !== 'success') return undefined;
    const id = setTimeout(() => {
      setOpen(false);
      setStep('off');
    }, SUCCESS_BEAT_MS);
    return () => clearTimeout(id);
  }, [step]);
  return (
    <YStack gap="$4" alignItems="flex-start">
      <XStack gap="$2" flexWrap="wrap">
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
          variant={step === 'success' ? 'primary' : undefined}
          onPress={handleSuccess}
        >
          Success
        </Button>
      </XStack>
      <DeviceStage
        {...props}
        open={open}
        step={step}
        onOpenChange={handleOpenChange}
        inputError={inputError}
        onPinSubmit={handlePinSubmit}
        onPassphraseSubmit={handlePassphraseSubmit}
        onPassphraseAttachPin={handlePassphraseAttachPin}
        onSwitchToDevice={handleSwitchToDevice}
        onQrNext={handleQrNext}
        onQrBack={handleQrBack}
        onErrorAction={handleErrorAction}
        backgroundInteractive
      />
    </YStack>
  );
}

/**
 * The event console: every button is something the device or the SDK could
 * say next, pressable in any order — there is no fixed sequence to script.
 * Submitting either app-side input moves to processing; "Wrong PIN" returns
 * the refused entry to the pad with its inline retry line; the error step's
 * recovery button routes by the selected reason; success holds its beat and
 * closes itself. Closing resets the stage to its dark start.
 */
export const FlowDemo: Story = {
  render: FlowDemoStage,
};

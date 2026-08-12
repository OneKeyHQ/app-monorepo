import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { DeviceStage } from '@onekeyhq/components/src/composite/DeviceStage';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

type IStageStep = ComponentProps<typeof DeviceStage>['step'];

// One dialog per hardware burst, content swapped in place — the point of the
// module is that consecutive device requests never close and reopen the
// surface. FlowDemo drives the burst by hand: present starts dark, the first
// lit step renders content onto the glass, later steps hand the glass over
// and then swap the words, and confirm compacts the stage before the screen,
// the words and the payload card follow in turn — strictly one motion at a
// time.
//
// The stage is a fixed dark theater (the Wallet treatment): an opaque
// near-black face whatever the shell theme. The shell theme only changes the
// app behind the sheet.

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
    locked: { control: 'boolean' },
  },
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

/* Manual drive of the burst. The buttons live at the top of the host
 * screen, not in the dialog; backgroundInteractive keeps them pressable
 * while the sheet is up — a native-only capability, so on web the modal
 * backdrop covers them once the stage is presented. Present starts dark;
 * closing resets to dark. */
function FlowDemoStage(props: ComponentProps<typeof DeviceStage>) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<IStageStep>('off');
  const handlePresent = useCallback(() => {
    setStep('off');
    setOpen(true);
  }, []);
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setStep('off');
    }
  }, []);
  const handleConnecting = useCallback(() => setStep('connecting'), []);
  const handleEnterPin = useCallback(() => setStep('enterPin'), []);
  const handleEnterPassphrase = useCallback(
    () => setStep('enterPassphrase'),
    [],
  );
  const handleConfirm = useCallback(() => setStep('confirm'), []);
  return (
    <YStack gap="$4" alignItems="flex-start">
      <XStack gap="$2" flexWrap="wrap">
        <Button onPress={handlePresent}>Present</Button>
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
          Enter PIN
        </Button>
        <Button
          variant={step === 'enterPassphrase' ? 'primary' : undefined}
          onPress={handleEnterPassphrase}
        >
          Passphrase
        </Button>
        <Button
          variant={step === 'confirm' ? 'primary' : undefined}
          onPress={handleConfirm}
        >
          Confirm
        </Button>
      </XStack>
      <DeviceStage
        {...props}
        open={open}
        step={step}
        onOpenChange={handleOpenChange}
        backgroundInteractive
      />
    </YStack>
  );
}

/**
 * Manual drive: present, then walk connecting → enter PIN → passphrase →
 * confirm with the buttons at the top of the host screen — the sheet
 * keeps the app behind it interactive, so they stay pressable while it
 * is up. Closing resets the stage to its dark start.
 */
export const FlowDemo: Story = {
  render: FlowDemoStage,
};

import { DeviceStage } from '@onekeyhq/components/src/composite/DeviceStage';
import type { IDeviceStageProps } from '@onekeyhq/components/src/composite/DeviceStage';

import {
  ARG_TYPES,
  DEMO,
  StageHost,
  StepButton,
  useStageDriver,
} from './harness';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const meta = {
  title: 'Composite/DeviceStage/Passphrase',
  component: DeviceStage,
  args: {
    step: 'off',
    deviceType: 'pro2',
    deviceName: DEMO.deviceName,
    // The flow spec's plain entry shape; flip to 'create' for the
    // Add-hidden-wallet titling and its Keep-accessible switch. The
    // empty-entry refusal is common to both.
    passphraseMode: 'verify',
  },
  argTypes: {
    step: ARG_TYPES.step,
    deviceType: ARG_TYPES.deviceType,
    passphraseMode: ARG_TYPES.passphraseMode,
  },
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

// The hidden-wallet family: the wallet-type fork (the live
// Select-wallet-type dialog as a step — standard heads into the create
// burst, hidden opens the intro), the teach-first intro (Continue lands
// on the in-app form), on-device entry, the in-app form with its
// create/verify split, and the attach-PIN alternative hopping to the
// device pad.
function PassphraseStage(props: IDeviceStageProps) {
  const driver = useStageDriver(props);
  return (
    <StageHost driver={driver} props={props}>
      <StepButton driver={driver} step="off">
        Off
      </StepButton>
      <StepButton driver={driver} step="selectWalletType">
        Wallet type
      </StepButton>
      <StepButton driver={driver} step="passphraseIntro">
        Hidden wallet intro
      </StepButton>
      <StepButton driver={driver} step="enterPassphrase">
        Passphrase on device
      </StepButton>
      <StepButton driver={driver} step="passphraseOnApp">
        Passphrase in app
      </StepButton>
      <StepButton driver={driver} step="enterPin">
        PIN on device
      </StepButton>
    </StageHost>
  );
}

export const Flow: Story = {
  render: PassphraseStage,
};

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
  title: 'Composite/DeviceStage/Console',
  component: DeviceStage,
  args: {
    step: 'off',
    deviceType: 'slate',
    deviceName: DEMO.deviceName,
    confirmContext: DEMO.confirmContext,
    confirmDetails: DEMO.confirmDetails,
    qrValue: DEMO.qrValue,
    passphraseMode: 'verify',
    errorReason: 'rejected',
    authFailureReason: 'unofficialDevice',
  },
  argTypes: {
    step: ARG_TYPES.step,
    deviceType: ARG_TYPES.deviceType,
    passphraseMode: ARG_TYPES.passphraseMode,
    errorReason: ARG_TYPES.errorReason,
    authFailureReason: ARG_TYPES.authFailureReason,
    qrValue: ARG_TYPES.qrValue,
  },
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

// The whole vocabulary on one console, for what no per-family story can
// exercise: cross-family flips, springs re-aimed between arbitrary
// poses, mid-flight everything. Waiting beats rest as the capsule; every
// ask blooms into the card at its own measured height.
function ConsoleStage(props: IDeviceStageProps) {
  const driver = useStageDriver(props);
  return (
    <StageHost driver={driver} props={props}>
      <StepButton driver={driver} step="off">
        Off
      </StepButton>
      <StepButton driver={driver} step="connecting">
        Connecting
      </StepButton>
      <StepButton driver={driver} step="enterPin">
        PIN on device
      </StepButton>
      <StepButton driver={driver} step="pinOnApp">
        PIN in app
      </StepButton>
      <StepButton
        driver={driver}
        testID="device-stage-demo-wrong-pin"
        onPress={driver.wrongPin}
      >
        Wrong PIN
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
      <StepButton driver={driver} step="confirm">
        Confirm
      </StepButton>
      <StepButton driver={driver} step="showQr">
        Show QR
      </StepButton>
      <StepButton driver={driver} step="scanQr">
        Scan QR
      </StepButton>
      <StepButton driver={driver} step="processing">
        Processing
      </StepButton>
      <StepButton driver={driver} step="error">
        Error
      </StepButton>
      <StepButton
        driver={driver}
        step="genuineCheck"
        onPress={driver.goGenuineCheck}
      >
        Genuine check
      </StepButton>
      <StepButton
        driver={driver}
        step="authVerifying"
        onPress={driver.goAuthVerifying}
      >
        Verifying
      </StepButton>
      <StepButton
        driver={driver}
        testID="device-stage-demo-auth-checklist"
        onPress={driver.startAuthChecklist}
      >
        Verifying · checklist
      </StepButton>
      <StepButton
        driver={driver}
        step="authSuccess"
        onPress={driver.goAuthSuccess}
      >
        Verify success
      </StepButton>
      <StepButton
        driver={driver}
        step="authFailure"
        onPress={driver.goAuthFailure}
      >
        Auth failure
      </StepButton>
    </StageHost>
  );
}

export const Flow: Story = {
  render: ConsoleStage,
};

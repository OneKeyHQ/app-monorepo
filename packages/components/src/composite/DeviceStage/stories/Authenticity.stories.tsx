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
  title: 'Composite/DeviceStage/Authenticity',
  component: DeviceStage,
  args: {
    step: 'off',
    deviceType: 'pro2',
    deviceName: DEMO.deviceName,
    authFailureReason: 'unofficialDevice',
  },
  argTypes: {
    step: ARG_TYPES.step,
    deviceType: ARG_TYPES.deviceType,
    authFailureReason: ARG_TYPES.authFailureReason,
  },
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

// The genuine check: the on-device ask, the wait in both shapes (legacy
// single check, and the checklist scripting itself row by row into the
// landing), the success wallpaper, and the six failure cards — pick the
// reason with the control; recoverable failures offer Retry and Support.
function AuthenticityStage(props: IDeviceStageProps) {
  const driver = useStageDriver(props);
  return (
    <StageHost driver={driver} props={props}>
      <StepButton driver={driver} step="off">
        Off
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
  render: AuthenticityStage,
};

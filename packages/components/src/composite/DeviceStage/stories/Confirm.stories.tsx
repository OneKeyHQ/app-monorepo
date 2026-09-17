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

/**
 * The confirm beat rests as the capsule (2026-09-11): the ask's title
 * over the device's name beside the replica thumbnail. The payload card
 * it used to play stays wired but parked — see CONFIRM_PAYLOAD_HIDDEN in
 * kit-bg's DeviceStageBurst; git history keeps its scenario stories.
 */

const meta = {
  title: 'Composite/DeviceStage/Confirm',
  component: DeviceStage,
  args: {
    step: 'off',
    deviceType: 'pro2',
    deviceName: DEMO.deviceName,
  },
  argTypes: {
    step: ARG_TYPES.step,
    deviceType: ARG_TYPES.deviceType,
  },
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

// The confirm move at full length: the neighbors on either side — the
// PIN card folding into the capsule, the capsule's words swapping to
// the processing wait — and the exit.
function ConfirmStage(props: IDeviceStageProps) {
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
      <StepButton driver={driver} step="confirm">
        Confirm
      </StepButton>
      <StepButton driver={driver} step="processing">
        Processing
      </StepButton>
    </StageHost>
  );
}

export const Flow: Story = {
  render: ConfirmStage,
};

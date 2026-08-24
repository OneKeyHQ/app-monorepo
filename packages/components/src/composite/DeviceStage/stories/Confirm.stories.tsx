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
  title: 'Composite/DeviceStage/Confirm',
  component: DeviceStage,
  args: {
    step: 'off',
    deviceType: 'slate',
    deviceName: DEMO.deviceName,
    confirmDetails: DEMO.confirmDetails,
  },
  argTypes: {
    step: ARG_TYPES.step,
    deviceType: ARG_TYPES.deviceType,
  },
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

// The confirm move: the full stage (PIN on device makes a neighbor for
// the shrink), then the miniature with context line and the payload card
// queuing in last on the arrangement clock, then out through processing.
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

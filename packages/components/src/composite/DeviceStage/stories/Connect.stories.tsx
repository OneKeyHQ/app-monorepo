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
  title: 'Composite/DeviceStage/Connect',
  component: DeviceStage,
  args: {
    step: 'off',
    deviceType: 'pro2',
    deviceName: DEMO.deviceName,
    errorReason: 'rejected',
  },
  argTypes: {
    step: ARG_TYPES.step,
    deviceType: ARG_TYPES.deviceType,
    errorReason: ARG_TYPES.errorReason,
  },
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

// Presence and the waiting beats: the capsule's entrance and exit, its
// in-place word swap (connecting ↔ processing), and the terminal error
// card with its reason-picked recovery route.
function ConnectStage(props: IDeviceStageProps) {
  const driver = useStageDriver(props);
  return (
    <StageHost driver={driver} props={props}>
      <StepButton driver={driver} step="off">
        Off
      </StepButton>
      <StepButton driver={driver} step="connecting">
        Connecting
      </StepButton>
      <StepButton driver={driver} step="processing">
        Processing
      </StepButton>
      <StepButton driver={driver} step="error">
        Error
      </StepButton>
    </StageHost>
  );
}

export const Flow: Story = {
  render: ConnectStage,
};

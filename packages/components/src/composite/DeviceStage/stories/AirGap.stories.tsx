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
  title: 'Composite/DeviceStage/AirGap',
  component: DeviceStage,
  args: {
    step: 'off',
    deviceType: 'slate',
    deviceName: DEMO.deviceName,
    qrValue: DEMO.qrValue,
  },
  argTypes: {
    step: ARG_TYPES.step,
    deviceType: ARG_TYPES.deviceType,
    qrValue: ARG_TYPES.qrValue,
  },
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

// The air-gap pair: the app presents its code (Next moves to scanning),
// then the camera frame scans the device's answer (Back returns to the
// code). No replica on stage — the person is holding the device.
function AirGapStage(props: IDeviceStageProps) {
  const driver = useStageDriver(props);
  return (
    <StageHost driver={driver} props={props}>
      <StepButton driver={driver} step="off">
        Off
      </StepButton>
      <StepButton driver={driver} step="showQr">
        Show QR
      </StepButton>
      <StepButton driver={driver} step="scanQr">
        Scan QR
      </StepButton>
    </StageHost>
  );
}

export const Flow: Story = {
  render: AirGapStage,
};

import { useCallback, useMemo } from 'react';

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
  title: 'Composite/DeviceStage/Pin',
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

// The PIN pair: on-device entry with the staged replica, the in-app
// blind pad (submit runs to processing, the switch hops sides), and the
// refusal beat landing back on the pad with its inline error.
function PinStage(props: IDeviceStageProps) {
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
    </StageHost>
  );
}

export const Flow: Story = {
  render: PinStage,
};

// The switch entry (OK-61489): a button device resting on the on-device
// default offers "Prefer to enter PIN in app?" in the description seat;
// the tap fakes the background write (a beat of latency), then the line
// lands as the set-to-app banner. Confirmed lives per card stay — the
// production surface is permanently mounted, so leaving enterPin resets
// it and the next card's wiring decides eligibility afresh. Replay the
// demo by stepping away (PIN in app / Off) and coming back.
function PinSwitchStage(props: IDeviceStageProps) {
  const driver = useStageDriver(props);
  const handleSwitchPinInputToApp = useCallback(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 350);
      }),
    [],
  );
  const merged = useMemo(
    () => ({ ...props, onSwitchPinInputToApp: handleSwitchPinInputToApp }),
    [handleSwitchPinInputToApp, props],
  );
  return (
    <StageHost driver={driver} props={merged}>
      <StepButton driver={driver} step="off">
        Off
      </StepButton>
      <StepButton driver={driver} step="enterPin">
        PIN on device
      </StepButton>
      <StepButton driver={driver} step="pinOnApp">
        PIN in app
      </StepButton>
    </StageHost>
  );
}

export const SwitchEntry: Story = {
  args: {
    deviceType: 'classic',
  },
  render: PinSwitchStage,
};

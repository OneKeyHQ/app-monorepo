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
  title: 'Composite/DeviceStage/Connect',
  component: DeviceStage,
  args: {
    step: 'off',
    deviceType: 'pro2',
    deviceName: DEMO.deviceName,
    connectionType: 'bluetooth',
    errorReason: 'rejected',
  },
  argTypes: {
    step: ARG_TYPES.step,
    deviceType: ARG_TYPES.deviceType,
    connectionType: ARG_TYPES.connectionType,
    errorReason: ARG_TYPES.errorReason,
  },
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

// Presence and the waiting beats: the capsule's entrance and exit, its
// in-place word swap (connecting ↔ processing), the wireless wait's
// Bluetooth badge (the transport control; 'usb' keeps the replica), the
// not-found card with its retry and the current UI's self-check pair,
// and the terminal error: the ask card with its reason-picked recovery
// route, and the actionless notice — the failure capsule that informs
// and leaves on its own.
function ConnectStage(props: IDeviceStageProps) {
  const driver = useStageDriver(props);
  // The OneKey not-found card is the current UI's dialog verbatim: the
  // pair only, no retry (the person closes and tries again, as live).
  // The live driver opens the help article / raises Intercom here.
  const handleNotFoundTroubleshoot = useCallback(() => {}, []);
  const handleNotFoundSupport = useCallback(() => {}, []);
  const stageProps: IDeviceStageProps = useMemo(
    () => ({
      ...props,
      onDeviceNotFoundTroubleshoot: handleNotFoundTroubleshoot,
      onDeviceNotFoundSupport: handleNotFoundSupport,
    }),
    [handleNotFoundSupport, handleNotFoundTroubleshoot, props],
  );
  return (
    <StageHost driver={driver} props={stageProps}>
      <StepButton driver={driver} step="off">
        Off
      </StepButton>
      <StepButton driver={driver} step="connecting">
        Connecting
      </StepButton>
      <StepButton driver={driver} step="processing">
        Processing
      </StepButton>
      <StepButton driver={driver} step="deviceNotFound">
        Not found
      </StepButton>
      <StepButton driver={driver} step="error">
        Error
      </StepButton>
      <StepButton
        driver={driver}
        onPress={driver.goErrorNotice}
        testID="device-stage-demo-error-notice"
      >
        Error · notice
      </StepButton>
    </StageHost>
  );
}

export const Flow: Story = {
  render: ConnectStage,
};

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DeviceStage } from '@onekeyhq/components/src/composite/DeviceStage';
import type { IDeviceStageProps } from '@onekeyhq/components/src/composite/DeviceStage';

import { ARG_TYPES, StageHost, StepButton, useStageDriver } from './harness';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const meta = {
  title: 'Composite/DeviceStage/ThirdParty',
  component: DeviceStage,
  args: {
    step: 'off',
    vendor: 'ledger',
    vendorModel: 'nanoX',
    appName: 'Ethereum',
    passphraseMode: 'verify',
    errorReason: 'rejected',
  },
  argTypes: {
    step: ARG_TYPES.step,
    vendor: {
      control: 'inline-radio',
      options: ['ledger', 'trezor'],
    },
    // The avatar mapping's first key: Ledger DMK codes, Trezor internal
    // models. Unlisted/empty falls back to the brand-generic shot.
    vendorModel: {
      control: 'select',
      options: ['nanoX', 'nanoS', 'stax', 'flex', 'apexp', 'T3W1', 'T2T1', ''],
    },
    appName: { control: 'text' },
    passphraseMode: ARG_TYPES.passphraseMode,
    errorReason: ARG_TYPES.errorReason,
  },
} satisfies Meta<typeof DeviceStage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The demo's batch queue, the current UI's own example shape. */
const BATCH_QUEUE = ['Bitcoin', 'Ethereum', 'Polygon'];
const SIM_TICK_MS = 350;
const SIM_TICK_PCT = 9;

// The vendor track on one console: every passive SDK event as a capsule
// beat (model shot on the left), the decision/input/progress cards, and
// a driver-simulated install clock — the stage itself only ever renders
// the progress it is handed, the way the real driver feeds DMK numbers.
function ThirdPartyStage(props: IDeviceStageProps) {
  const driver = useStageDriver(props);
  const { go, step } = driver;
  const [installProgress, setInstallProgress] = useState(0);
  const [installActiveIndex, setInstallActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopSim = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => stopSim, [stopSim]);
  // Leaving the install steps by any road (buttons, close) parks the sim.
  useEffect(() => {
    if (step !== 'installing' && step !== 'installBatch') {
      stopSim();
    }
  }, [step, stopSim]);
  const startInstall = useCallback(() => {
    stopSim();
    setInstallProgress(0);
    go('installing');
    timerRef.current = setInterval(() => {
      setInstallProgress((current) => {
        const next = current + SIM_TICK_PCT;
        if (next >= 100) {
          stopSim();
          go('done');
          return 100;
        }
        return next;
      });
    }, SIM_TICK_MS);
  }, [go, stopSim]);
  const startBatch = useCallback(() => {
    stopSim();
    setInstallProgress(0);
    setInstallActiveIndex(0);
    go('installBatch');
    timerRef.current = setInterval(() => {
      setInstallProgress((current) => {
        const next = current + SIM_TICK_PCT;
        if (next < 100) {
          return next;
        }
        setInstallActiveIndex((index) => {
          if (index + 1 >= BATCH_QUEUE.length) {
            stopSim();
            go('done');
            return index;
          }
          return index + 1;
        });
        return 0;
      });
    }, SIM_TICK_MS);
  }, [go, stopSim]);
  const handlePairingSubmit = useCallback(() => go('processing'), [go]);
  const handleNotFoundRetry = useCallback(() => go('searching'), [go]);
  const handleHighIndexConfirm = useCallback(() => go('confirmOnDevice'), [go]);
  // The vendor passphrase's "Enter on device": the person continues on
  // the Trezor itself, so the flow falls back to the passive confirm
  // capsule — never the OneKey staged step the shared driver aims at.
  const handleVendorSwitchToDevice = useCallback(
    () => go('confirmOnDevice'),
    [go],
  );
  const vendorDriver = useMemo(
    () => ({
      ...driver,
      stageProps: {
        ...driver.stageProps,
        onSwitchToDevice: handleVendorSwitchToDevice,
      },
    }),
    [driver, handleVendorSwitchToDevice],
  );
  const stageProps: IDeviceStageProps = useMemo(
    () => ({
      ...props,
      installProgress,
      installQueue: BATCH_QUEUE,
      installActiveIndex,
      btcHighIndexPath: "m/44'/0'/100'",
      btcHighIndexAccountIndex: 100,
      onPairingSubmit: handlePairingSubmit,
      onDeviceNotFoundRetry: handleNotFoundRetry,
      onBtcHighIndexConfirm: handleHighIndexConfirm,
      onInstallConfirm: startInstall,
    }),
    [
      handleHighIndexConfirm,
      handleNotFoundRetry,
      handlePairingSubmit,
      installActiveIndex,
      installProgress,
      props,
      startInstall,
    ],
  );
  return (
    <StageHost driver={vendorDriver} props={stageProps}>
      <StepButton driver={driver} step="off">
        Off
      </StepButton>
      <StepButton driver={driver} step="searching">
        Searching
      </StepButton>
      <StepButton driver={driver} step="connecting">
        Connecting
      </StepButton>
      <StepButton driver={driver} step="confirmOnDevice">
        Confirm on device
      </StepButton>
      <StepButton driver={driver} step="openApp">
        Open app
      </StepButton>
      <StepButton driver={driver} step="unlockDevice">
        Unlock
      </StepButton>
      <StepButton driver={driver} step="processing">
        Processing
      </StepButton>
      <StepButton driver={driver} step="done">
        Done
      </StepButton>
      <StepButton driver={driver} step="pairingCode">
        Pair code
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
      <StepButton driver={driver} step="passphraseOnApp">
        Passphrase in app
      </StepButton>
      <StepButton driver={driver} step="deviceNotFound">
        Not found
      </StepButton>
      <StepButton driver={driver} step="btcHighIndex">
        BTC high index
      </StepButton>
      <StepButton driver={driver} step="installConfirm">
        Install
      </StepButton>
      <StepButton
        driver={driver}
        testID="device-stage-demo-install-batch"
        onPress={startBatch}
      >
        Install batch
      </StepButton>
      <StepButton driver={driver} step="error">
        Error
      </StepButton>
    </StageHost>
  );
}

export const Flow: Story = {
  render: ThirdPartyStage,
};

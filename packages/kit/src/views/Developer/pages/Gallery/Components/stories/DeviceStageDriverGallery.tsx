import { useCallback, useState } from 'react';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDeviceStageAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { Layout } from './utils/Layout';

// OK-59934 demo driver: plays burst scripts against the REAL pipeline
// (DeviceStageBurstScope → deviceStageAtom → DeviceStageContainer), so the
// one-entrance-one-exit rule is verifiable without hardware. Interactive
// steps (PIN) wait for real input on the stage.

type IScenario =
  | 'sign'
  | 'signOnDevice'
  | 'reject'
  | 'disconnect'
  | 'trezorSign'
  | 'ledgerInstall';

const SCENARIOS: Array<{ scenario: IScenario; label: string; note: string }> = [
  {
    scenario: 'sign',
    label: 'Sign burst (Classic, 2 calls)',
    note: 'connecting → pinOnApp (type any PIN) → confirm → processing → confirm (call #2) → off. One entrance, one exit.',
  },
  {
    scenario: 'signOnDevice',
    label: 'Sign burst (Pro 2, PIN on device)',
    note: 'connecting → enterPin → processing → confirm → off.',
  },
  {
    scenario: 'reject',
    label: 'Device rejects',
    note: 'confirm → error(rejected) notice: ✗ capsule, self-dismisses in ~3s, no toast.',
  },
  {
    scenario: 'disconnect',
    label: 'Device disconnects',
    note: 'processing → error(disconnected) notice: ✗ capsule, self-dismisses in ~3s.',
  },
  {
    scenario: 'trezorSign',
    label: 'Trezor sign (matrix PIN)',
    note: 'connecting → unlockDevice → matrix pinOnApp → confirmOnDevice → done ✓ → off. Capsule wears the Safe 7 product shot.',
  },
  {
    scenario: 'ledgerInstall',
    label: 'Ledger app install',
    note: 'connecting → installConfirm → installing (real progress) → done ✓ → off. Nano X product shot.',
  },
];

const DeviceStageDriverGallery = () => {
  const [stage] = useDeviceStageAtom();
  const [running, setRunning] = useState(false);

  const runScenario = useCallback(async (scenario: IScenario) => {
    setRunning(true);
    try {
      await backgroundApiProxy.serviceHardwareUI.demoDeviceStageBurst({
        scenario,
      });
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <Layout
      componentName="DeviceStageDriver"
      elements={[
        {
          title: 'Burst scenarios (simulated events, real pipeline)',
          element: (
            <YStack gap="$3">
              {SCENARIOS.map(({ scenario, label, note }) => (
                <YStack key={scenario} gap="$1">
                  <Button
                    disabled={running}
                    onPress={() => runScenario(scenario)}
                  >
                    {label}
                  </Button>
                  <SizableText size="$bodySm" color="$textSubdued">
                    {note}
                  </SizableText>
                </YStack>
              ))}
            </YStack>
          ),
        },
        {
          title: 'Stage state',
          element: (
            <SizableText size="$bodySm">
              {stage
                ? `burstId=${stage.burstId} step=${stage.step} device=${
                    stage.deviceType ?? '-'
                  } error=${stage.errorReason ?? '-'}`
                : '(empty)'}
            </SizableText>
          ),
        },
      ]}
    />
  );
};

export default DeviceStageDriverGallery;

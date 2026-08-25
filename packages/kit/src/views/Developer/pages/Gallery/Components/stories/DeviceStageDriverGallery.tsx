import { useCallback, useState } from 'react';

import {
  Button,
  SizableText,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useDeviceStageAtom,
  useDeviceStageEnabledAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { Layout } from './utils/Layout';

// OK-59934 demo driver: plays burst scripts against the REAL pipeline
// (DeviceStageBurstScope → deviceStageAtom → DeviceStageContainer), so the
// one-entrance-one-exit rule is verifiable without hardware. Interactive
// steps (PIN) wait for real input on the stage.

type IScenario = 'sign' | 'signOnDevice' | 'reject' | 'disconnect';

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
    note: 'confirm → error(rejected) on the same stage, no toast.',
  },
  {
    scenario: 'disconnect',
    label: 'Device disconnects',
    note: 'processing → error(disconnected) on the same stage.',
  },
];

const DeviceStageDriverGallery = () => {
  const [enabled] = useDeviceStageEnabledAtom();
  const [stage] = useDeviceStageAtom();
  const [running, setRunning] = useState(false);

  const handleToggle = useCallback((value: boolean) => {
    void backgroundApiProxy.serviceHardwareUI.setDeviceStageEnabled({
      enabled: value,
    });
  }, []);

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
          title: 'Rollout gate',
          element: (
            <XStack gap="$4" alignItems="center">
              <Switch value={enabled} onChange={handleToggle} />
              <SizableText>
                {enabled
                  ? 'DeviceStage ON — legacy hardware dialogs muted'
                  : 'DeviceStage OFF — legacy behavior'}
              </SizableText>
            </XStack>
          ),
        },
        {
          title: 'Burst scenarios (simulated events, real pipeline)',
          element: (
            <YStack gap="$3">
              {SCENARIOS.map(({ scenario, label, note }) => (
                <YStack key={scenario} gap="$1">
                  <Button
                    disabled={!enabled || running}
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

import { useCallback } from 'react';

import { ActionList, Icon, IconButton, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { POOLS_COPY } from '../poolsCopy';
import { emitPoolsDataChanged } from '../poolsDemoEvents';

/**
 * Demo-only controls: make the next simulated transaction fail (to show a
 * stopped Zap and its continue / abandon flow) and reset the mock data.
 */
export function PoolsDemoMenuButton({
  onReset,
  testID = 'earn-pools-demo-menu',
}: {
  onReset?: () => void;
  testID?: string;
}) {
  const open = useCallback(async () => {
    const settings = await backgroundApiProxy.servicePools.getDemoSettings();
    ActionList.show({
      title: POOLS_COPY.demo,
      items: [
        {
          label: POOLS_COPY.failNextStep,
          icon: 'XCircleOutline',
          // A switch more than an action: a tick shows it is on
          extra: settings.failNextStep ? (
            <Icon name="CheckLargeOutline" size="$5" color="$iconActive" />
          ) : undefined,
          onPress: async () => {
            await backgroundApiProxy.servicePools.setDemoSettings({
              failNextStep: !settings.failNextStep,
            });
          },
        },
        {
          label: POOLS_COPY.resetDemo,
          icon: 'RefreshCcwOutline',
          destructive: true,
          onPress: async () => {
            await backgroundApiProxy.servicePools.resetDemo();
            Toast.success({ title: POOLS_COPY.resetDone });
            emitPoolsDataChanged();
            onReset?.();
          },
        },
      ],
    });
  }, [onReset]);

  return (
    <IconButton
      testID={testID}
      variant="tertiary"
      icon="DotHorOutline"
      onPress={() => void open()}
    />
  );
}

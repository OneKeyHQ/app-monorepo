import { useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useDeviceAtom } from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';

import { ListItemGroup } from '../ListItemGroup';

// DEV-ONLY Trezor THP debug tools. Rendered at the bottom of the device details
// modal and gated behind developer mode + Trezor vendor by the parent. Strings
// are hardcoded on purpose — this never ships to real users.
function DeviceSectionTrezorDebug() {
  const [device] = useDeviceAtom();
  const dbDeviceId = device?.id;

  const onCorrupt = useCallback(async () => {
    if (!dbDeviceId) return;
    try {
      const { corrupted } =
        await backgroundApiProxy.serviceThirdPartyHardware.devCorruptTrezorThpCredentials(
          { dbDeviceId },
        );
      Toast.success({
        title:
          corrupted > 0
            ? `Corrupted ${corrupted} THP credential(s). Reconnect to trigger a failed handshake.`
            : 'No stored THP credentials. Pair the device first.',
      });
    } catch (error) {
      Toast.error({ title: (error as Error)?.message || 'Failed' });
    }
  }, [dbDeviceId]);

  const onClear = useCallback(async () => {
    if (!dbDeviceId) return;
    try {
      await backgroundApiProxy.serviceThirdPartyHardware.devClearTrezorThpState(
        {
          dbDeviceId,
        },
      );
      Toast.success({
        title: 'Cleared THP handshake + BLE binding. Reconnect to re-pair.',
      });
    } catch (error) {
      Toast.error({ title: (error as Error)?.message || 'Failed' });
    }
  }, [dbDeviceId]);

  if (!dbDeviceId) return null;

  return (
    <ListItemGroup
      withSeparator
      itemProps={{ minHeight: '$12' }}
      title="Developer · Trezor THP"
    >
      <ListItem
        title="Randomize bad THP handshake"
        subtitle="Corrupt stored credentials so the next handshake is rejected"
        titleProps={{ size: '$bodyMdMedium', color: '$textCritical' }}
        drillIn
        onPress={onCorrupt}
      />
      <ListItem
        title="Clear THP handshake"
        subtitle="Remove credentials + BLE binding to force re-pairing"
        titleProps={{ size: '$bodyMdMedium', color: '$textCritical' }}
        drillIn
        onPress={onClear}
      />
    </ListItemGroup>
  );
}

export default DeviceSectionTrezorDebug;

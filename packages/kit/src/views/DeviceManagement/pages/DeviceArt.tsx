import { Stack } from '@onekeyhq/components';
import {
  HardwareDevice,
  getHardwareDeviceAspect,
} from '@onekeyhq/components/src/content/HardwareDevice';
import type { IHardwareDeviceType } from '@onekeyhq/components/src/content/HardwareDevice';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IHardwareDeviceColor } from '@onekeyhq/shared/src/utils/hardwareDeviceColors';

// The device as drawn for its model, lit on the home screen it idles on.
// Models without a drawing (Trezor, Ledger) keep the wallet avatar.
export function DeviceArt({
  deviceType,
  color,
  wallet,
  height,
}: {
  deviceType: IHardwareDeviceType | undefined;
  color: IHardwareDeviceColor | undefined;
  wallet: IDBWallet | undefined;
  height: number;
}) {
  const aspect = getHardwareDeviceAspect(deviceType);
  if (!aspect) {
    return <WalletAvatar size={height} wallet={wallet} status="default" />;
  }
  const width = Math.round(height / aspect);
  return (
    <Stack w={width} h={height} flexShrink={0} pointerEvents="none" aria-hidden>
      <HardwareDevice
        deviceType={deviceType}
        color={color}
        width={width}
        // The scene that shows the idle home screen; arriving already lit
        // keeps a wake-up from reading as the device connecting.
        animation="connecting"
        instantEntry
        shadow
      />
    </Stack>
  );
}

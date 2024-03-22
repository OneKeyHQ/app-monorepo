import { useEffect, useState } from 'react';

import type { IWallet } from '@onekeyhq/engine/src/types';
import type { Device } from '@onekeyhq/engine/src/types/device';
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';

import backgroundApiProxy from '../../../../../../background/instance/backgroundApiProxy';

function useDeviceMenu({
  wallet,
  asset,
}: {
  wallet: IWallet | undefined;
  asset: NFTAsset;
}) {
  const [device, setDevice] = useState<Device | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    (async () => {
      if (!wallet || wallet.type !== 'hw') {
        setShowMenu(false);
        return;
      }
      const hwDevice = await backgroundApiProxy.engine.getHWDeviceByWalletId(
        wallet.id,
      );
      const supportContentType = [
        'image/gif',
        'image/svg',
        'image/png',
        'image/jpeg',
        'image/jpg',
      ];
      const isSupportType = supportContentType.includes(
        asset.contentType ?? '',
      );
      const isTouch =
        hwDevice?.deviceType === 'touch' || hwDevice?.deviceType === 'pro';
      setShowMenu(isTouch && isSupportType);
      setDevice(hwDevice);
    })();
  }, [wallet, asset]);

  return {
    device,
    showMenu,
  };
}

export { useDeviceMenu };

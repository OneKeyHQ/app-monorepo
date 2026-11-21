import { useWalletMetadataPresentation } from '@onekeyhq/kit/src/hooks/useWalletMetadataPresentation';

import { useWalletWithDeviceAtom } from './atoms';

export * from './atoms';
export * from './actions';
export {
  canEditPro2DeviceWideSettings,
  getDeviceSecondaryIdentifier,
  resolveDeviceState,
  resolveDeviceWithCurrentType,
} from './deviceStateManagement';

// Device headers opt into the view-only wallet metadata projection.
export function useWalletWithDeviceForHeader() {
  const [canonical] = useWalletWithDeviceAtom();
  const wallet = useWalletMetadataPresentation(
    canonical?.wallet?.id,
    canonical?.wallet,
  );
  return [canonical && wallet ? { ...canonical, wallet } : canonical] as const;
}

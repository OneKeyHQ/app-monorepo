import { useCallback, useState } from 'react';

import type {
  IKeylessMnemonicInfo,
  IKeylessWalletPacks,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';

import { Layout } from '../utils/Layout';

import { CloudBackup } from './components/CloudBackup';
import { DeviceTransfer } from './components/DeviceTransfer';
import { GenerateKeylessWallet } from './components/GenerateKeylessWallet';
import { PacksManagement } from './components/PacksManagement';
import { RestoreMnemonicFromShares } from './components/RestoreMnemonicFromShares';
import { SecureStorageDemo } from './components/SecureStorageDemo';
import { KeylessWalletCreationFlow } from './KeylessWalletCreationFlow';
import { KeylessWalletRecoveryFlow } from './KeylessWalletRecoveryFlow';

export const KeylessWalletGallery = () => {
  const [mnemonic, setMnemonic] = useState('');
  const [shares, setShares] = useState<IKeylessMnemonicInfo | null>(null);
  const [packs, setPacks] = useState<IKeylessWalletPacks | null>(null);

  const handleGenerateMnemonic = useCallback(
    (generatedMnemonic: string, generatedShares: IKeylessMnemonicInfo) => {
      setMnemonic(generatedMnemonic);
      setShares(generatedShares);
      setPacks(null);
    },
    [],
  );

  const handlePacksChange = useCallback((newPacks: IKeylessWalletPacks) => {
    setPacks(newPacks);
    setMnemonic(newPacks.mnemonic);
    setShares(newPacks);
  }, []);

  const handleRestore = useCallback(
    (deviceKey: string, cloudKey: string, authKey: string) => {
      // Auto fill restore inputs if needed
      // This is handled internally by RestoreMnemonicFromShares component
    },
    [],
  );

  return (
    <Layout
      description="Keyless Wallet Generation & Restoration"
      suggestions={['Generate Wallet', 'Restore Mnemonic']}
      boundaryConditions={['Needs 2 of 3 keys to restore']}
      elements={[
        {
          title: 'Generate Keyless Wallet',
          element: (
            <GenerateKeylessWallet onGenerated={handleGenerateMnemonic} />
          ),
        },
        {
          title: 'Restore Mnemonic from Shares',
          element: (
            <RestoreMnemonicFromShares
              shares={shares}
              mnemonic={mnemonic}
              onRestore={handleRestore}
            />
          ),
        },
        {
          title: 'Packs',
          element: (
            <PacksManagement packs={packs} onPacksChange={handlePacksChange} />
          ),
        },
        {
          title: 'Cloud Backup (CloudKeyPack)',
          element: <CloudBackup packs={packs} />,
        },
        {
          title: 'Device Transfer (DeviceKeyPack)',
          element: <DeviceTransfer packs={packs} />,
        },
        {
          title: 'Secure Storage Demo',
          element: <SecureStorageDemo />,
        },
        {
          title: 'Complete Keyless Wallet Creation Flow',
          element: <KeylessWalletCreationFlow />,
        },
        {
          title: 'Complete Keyless Wallet Recovery Flow',
          element: <KeylessWalletRecoveryFlow />,
        },
      ]}
    />
  );
};

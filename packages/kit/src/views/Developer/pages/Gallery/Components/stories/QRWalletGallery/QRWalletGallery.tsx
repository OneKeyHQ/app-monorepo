import { Button, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Layout } from '../utils/Layout';

import { QRWalletGalleryImportAccount } from './QRWalletGalleryImportAccount';
import { QRWalletGallerySignTx } from './QRWalletGallerySignTx';

export function QRWalletGalleryDemo() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  return (
    <Stack space="$2">
      <Button
        onPress={() => {
          void backgroundApiProxy.serviceDemo.clearQrWalletAirGapAccountKeys({
            walletId: activeAccount?.wallet?.id || '',
          });
        }}
      >
        clear wallet airgap account keys
      </Button>
      <QRWalletGalleryImportAccount />
      <QRWalletGallerySignTx />
    </Stack>
  );
}

const QRWalletGallery = () => (
  <Layout
    description="--"
    suggestions={['--']}
    boundaryConditions={['--']}
    elements={[
      {
        title: '--',
        element: (
          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.home,
              sceneUrl: '',
            }}
            enabledNum={[0]}
          >
            <Stack space="$1">
              <QRWalletGalleryDemo />
            </Stack>
          </AccountSelectorProviderMirror>
        ),
      },
    ]}
  />
);

export default QRWalletGallery;

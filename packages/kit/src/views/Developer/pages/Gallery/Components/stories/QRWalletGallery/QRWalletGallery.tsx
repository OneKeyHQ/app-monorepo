import { range } from 'lodash';

import { Button, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import {
  EQRCodeHandlerNames,
  type IAnimationValue,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import type { IAirGapUrJson } from '@onekeyhq/qr-wallet-sdk';
import { AirGapUR, airGapUrUtils } from '@onekeyhq/qr-wallet-sdk';
import { OneKeyRequestDeviceQR } from '@onekeyhq/qr-wallet-sdk/src/OneKeyRequestDeviceQR';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Layout } from '../utils/Layout';

import { QRWalletGalleryImportAccount } from './QRWalletGalleryImportAccount';
import { QRWalletGallerySignTx } from './QRWalletGallerySignTx';

function CustomAppRequestDeviceQR() {
  const {
    start: startScan,
    // close,
  } = useScanQrCode();
  return (
    <Stack space="$2">
      <Button
        onPress={() => {
          const request = new OneKeyRequestDeviceQR({
            requestId: generateUUID(),
            xfp: '5c9e228d',
            deviceId: 'CLA8888',
            origin: 'OneKey iOS',
            //
            method: 'getMultiAccounts',
            params: [
              {
                chain: 'ETH',
                paths: range(0, 5).map((i) => `m/44'/60'/${i}'`),
                // paths: range(0, 5).map((i) => `m/44'/60'/${i}'/0/0`),
              },
            ],
          });
          const ur = request.toUR();

          console.log(request);
          console.log(airGapUrUtils.urToQrcode(ur));

          // TODO startTwoWayQrcodeScan
          appEventBus.emit(EAppEventBusNames.ShowQrcode, {
            drawType: 'animated',
            valueUr: airGapUrUtils.urToJson({ ur }),
            // promiseId,
          });
        }}
      >
        onekey-app-call-device getMultiAccounts()
      </Button>

      <Button
        onPress={() => {
          const request = new OneKeyRequestDeviceQR({
            requestId: generateUUID(),
            xfp: '5c9e228d',
            // deviceId: 'CLA8888',
            origin: 'OneKey Wallet',
            //
            method: 'verifyAddress',
            params: [
              {
                chain: 'ETH',
                path: "m/44'/60'/1'/0/0", // fullPath
                address: '',
                chainId: '1', // EVM only  evm--56
                // scriptType: '5', // BTC only
              },
            ],
          });
          const ur = request.toUR();

          console.log(request);
          console.log(airGapUrUtils.urToQrcode(ur));

          // TODO startTwoWayQrcodeScan
          appEventBus.emit(EAppEventBusNames.ShowQrcode, {
            drawType: 'animated',
            valueUr: airGapUrUtils.urToJson({ ur }),
            // promiseId,
          });
        }}
      >
        onekey-app-call-device verifyAddress()
      </Button>

      <Button
        onPress={async () => {
          const scanResult = await startScan({
            handlers: [EQRCodeHandlerNames.animation],
            qrWalletScene: true,
            autoHandleResult: false,
          });
          const animatedData = scanResult.data as IAnimationValue;
          const qrcode = animatedData.fullData || scanResult.raw || '';
          const ur = await airGapUrUtils.qrcodeToUr(qrcode);
          if (ur) {
            const requestQR = OneKeyRequestDeviceQR.fromUR(ur);
            console.log('requestQR', requestQR);
          }
        }}
      >
        Decode onekey-app-call-device
      </Button>
    </Stack>
  );
}

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
      <CustomAppRequestDeviceQR />
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

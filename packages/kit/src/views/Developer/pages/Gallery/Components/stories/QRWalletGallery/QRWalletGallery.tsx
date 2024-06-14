import { networks as BitcoinJsNetworks, Psbt } from 'bitcoinjs-lib';
import { range } from 'lodash';

import { Button, Stack } from '@onekeyhq/components';
import { decodedPsbt } from '@onekeyhq/core/src/chains/btc/sdkBtc/providerUtils';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import {
  EQRCodeHandlerNames,
  type IAnimationValue,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { airGapUrUtils, getAirGapSdk } from '@onekeyhq/qr-wallet-sdk';
import { OneKeyRequestDeviceQR } from '@onekeyhq/qr-wallet-sdk/src/OneKeyRequestDeviceQR';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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
          const sdk = getAirGapSdk();

          if (ur) {
            console.log('scan ur', ur);
            if (ur.type === 'onekey-app-call-device') {
              const requestQR = OneKeyRequestDeviceQR.fromUR(ur);
              console.log('requestQR', requestQR);
            }
            if (ur.type === 'crypto-psbt') {
              const network = BitcoinJsNetworks.bitcoin;
              const psbtHex = sdk.btc.parsePSBT(ur);
              const psbt = Psbt.fromHex(psbtHex);
              console.log('psbt before finalize', psbt);
              await timerUtils.wait(1000);
              const tx = decodedPsbt({ psbt, psbtNetwork: network });
              const signedTx = await coreChainApi.btc.hd.extractPsbtToSignedTx({
                psbt,
              });
              console.log('psbt finalized', psbt);
              console.log({
                qrcode,
                psbtHex,
                tx,
                signedTx,
                psbt,
                psbt2: {
                  txInputs: psbt.txInputs,
                  txOutputs: psbt.txOutputs,
                },
              });
            }
          }
        }}
      >
        Decode qrcode
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

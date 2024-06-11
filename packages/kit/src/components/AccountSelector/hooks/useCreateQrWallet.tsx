import { useCallback } from 'react';

import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EQRCodeHandlerNames,
  type IAnimationValue,
  type IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import type { IAirGapUrJson } from '@onekeyhq/qr-wallet-sdk';
import { airGapUrUtils } from '@onekeyhq/qr-wallet-sdk';
import { OneKeyErrorAirGapWalletMismatch } from '@onekeyhq/shared/src/errors';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import useScanQrCode from '../../../views/ScanQrCode/hooks/useScanQrCode';

type ICreateQrWalletByScanParams = {
  isOnboarding?: boolean;
  byWallet?: IDBWallet;
  byDevice?: IDBDevice;
};
export function useCreateQrWallet() {
  const {
    start: startScan,
    // close,
  } = useScanQrCode();
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();

  const createQrWalletByUr = useCallback(
    async (
      params: ICreateQrWalletByScanParams & {
        urJson: IAirGapUrJson;
      },
    ) => {
      const { urJson, byDevice, byWallet, isOnboarding } = params;
      const { qrDevice, airGapAccounts, airGapMultiAccounts } =
        await backgroundApiProxy.serviceQrWallet.buildAirGapMultiAccounts({
          urJson,
        });
      console.log(
        'startScan qrDevice:',
        qrDevice,
        airGapAccounts,
        airGapMultiAccounts,
      );
      if (byDevice?.deviceId && qrDevice?.deviceId !== byDevice?.deviceId) {
        throw new OneKeyErrorAirGapWalletMismatch();
      }
      if (byWallet?.xfp && qrDevice?.xfp !== byWallet?.xfp) {
        throw new OneKeyErrorAirGapWalletMismatch();
      }
      if (isOnboarding) {
        navigation.push(EOnboardingPages.FinalizeWalletSetup);
      }
      const result = await actions.current.createQrWallet({
        qrDevice,
        airGapAccounts,
        isOnboarding,
      });
      return result;
    },
    [actions, navigation],
  );

  const createQrWallet = useCallback(
    async (params: ICreateQrWalletByScanParams) => {
      const scanResult = await startScan({
        handlers: [EQRCodeHandlerNames.animation],
        qrWalletScene: true,
        autoHandleResult: false,
      });
      console.log('startScan:', scanResult.raw?.trim());

      const urScanResult =
        scanResult as IQRCodeHandlerParseResult<IAnimationValue>;
      const qrcode = urScanResult?.data?.fullData || urScanResult?.raw || '';
      const ur = await airGapUrUtils.qrcodeToUr(qrcode);
      const urJson = airGapUrUtils.urToJson({ ur });
      return createQrWalletByUr({
        ...params,
        urJson,
      });
    },
    [createQrWalletByUr, startScan],
  );

  // const createQrWalletByTwoWayScan = useCallback(
  //   async (params: ICreateQrWalletByScanParams) => {
  //     backgroundApiProxy.serviceQrWallet.startTwoWayAirGapScan()
  //   },
  //   [],
  // );

  return {
    createQrWallet,
    createQrWalletByUr,
  };
}

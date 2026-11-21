import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { resetToRoute } from '@onekeyhq/components';
import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAnimationValue,
  IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import type { AirGapUR, IAirGapUrJson } from '@onekeyhq/qr-wallet-sdk';
import {
  OneKeyErrorAirGapDeviceMismatch,
  OneKeyErrorAirGapWalletMismatch,
  OneKeyErrorScanQrCodeCancel,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import type { IAddressCreationRequest } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  EOnboardingPages,
  EOnboardingPagesV2,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { EOnboardingV2Routes } from '@onekeyhq/shared/src/routes/onboardingv2';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorage';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EQRCodeHandlerNames } from '@onekeyhq/shared/types/qrCode';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAccountSelectorLazyAction } from '../../../states/jotai/contexts/accountSelector/actionsLazy';
import useScanQrCodeLazy from '../../../views/ScanQrCode/hooks/useScanQrCodeLazy';
import {
  getAddressCreationRequestSignal,
  getAddressCreationRequestState,
} from '../../../views/ScanQrCode/utils/getAccountIdOnNetwork';

type ICreateQrWalletByScanParams = {
  isOnboarding?: boolean;
  isOnboardingV2?: boolean;
  byWallet?: IDBWallet;
  byDevice?: IDBDevice;
  onFinalizeWalletSetupError?: () => void;
};
export function useCreateQrWallet() {
  const intl = useIntl();
  const {
    start: startScan,
    // close,
  } = useScanQrCodeLazy();
  const callAccountSelectorAction = useAccountSelectorLazyAction();
  const navigation = useAppNavigation();

  const createQrWalletByUr = useCallback(
    async (
      params: ICreateQrWalletByScanParams & {
        urJson: IAirGapUrJson;
        isCreateAccountAction?: boolean;
        assertCanCreate?: () => void;
        addressCreationPromiseId?: number;
      },
    ) => {
      const {
        urJson,
        byWallet,
        isOnboarding,
        isOnboardingV2,
        byDevice,
        isCreateAccountAction,
        assertCanCreate,
        addressCreationPromiseId,
      } = params;
      const { qrDevice, airGapAccounts } =
        await backgroundApiProxy.serviceQrWallet.buildAirGapMultiAccounts({
          urJson,
        });
      assertCanCreate?.();
      if (isCreateAccountAction && byDevice?.deviceId && qrDevice?.deviceId) {
        if (byDevice?.deviceId !== qrDevice?.deviceId) {
          throw new OneKeyErrorAirGapDeviceMismatch();
        }
      }

      if (
        qrDevice?.xfp &&
        byWallet?.xfp &&
        accountUtils.getShortXfp({ xfp: qrDevice?.xfp }) !==
          accountUtils.getShortXfp({ xfp: byWallet?.xfp })
      ) {
        throw new OneKeyErrorAirGapWalletMismatch();
      }
      if (isOnboardingV2 || isOnboarding) {
        if (isOnboardingV2) {
          // Use resetToRoute to atomically replace overlay routes
          // (including the scan modal) with the target route.
          // navigation.push() fails on iOS because popScanModalPages
          // goBack() triggers a window-nil freeze (OK-51748).
          resetToRoute(ERootRoutes.Onboarding, {
            screen: EOnboardingV2Routes.OnboardingV2,
            params: {
              screen: EOnboardingPagesV2.FinalizeWalletSetup,
            },
          });
        } else {
          navigation.push(EOnboardingPages.FinalizeWalletSetup);
        }
      }
      try {
        const result = await callAccountSelectorAction('createQrWallet', {
          qrDevice,
          airGapAccounts,
          isOnboarding,
          assertCanCreate,
          addressCreationPromiseId,
        });
        return result;
      } catch (error) {
        params?.onFinalizeWalletSetupError?.();
        throw error;
      }
    },
    [callAccountSelectorAction, navigation],
  );

  const createQrWallet = useCallback(
    async (params: ICreateQrWalletByScanParams) => {
      const scanResult = await startScan({
        handlers: [EQRCodeHandlerNames.animation],
        qrWalletScene: true,
        autoExecuteParsedAction: false,
      });
      const fullURText = scanResult.raw?.trim();
      if (process.env.NODE_ENV !== 'production') {
        if (fullURText) {
          await appStorage.syncStorage.set(
            EAppSyncStorageKeys.last_scan_qr_code_text,
            fullURText,
          );
        }
      }

      const urScanResult =
        scanResult as IQRCodeHandlerParseResult<IAnimationValue>;
      const qrcode = urScanResult?.data?.fullData || urScanResult?.raw || '';
      const [{ airGapUrUtils }, { InvalidSchemeError }] = await Promise.all([
        import('@onekeyhq/qr-wallet-sdk'),
        import('@ngraveio/bc-ur/dist/errors'),
      ]);
      let ur: AirGapUR | undefined;
      try {
        ur = await airGapUrUtils.qrcodeToUr(qrcode);
      } catch (error: unknown) {
        if (error instanceof InvalidSchemeError) {
          throw new OneKeyLocalError(
            intl.formatMessage({ id: ETranslations.feedback_invalid_qr_code }),
          );
        }
      }
      const urJson = airGapUrUtils.urToJson({ ur });
      return createQrWalletByUr({
        ...params,
        urJson,
      });
    },
    [createQrWalletByUr, intl, startScan],
  );

  // const createQrWalletByTwoWayScan = useCallback(
  //   async (params: ICreateQrWalletByScanParams) => {
  //     backgroundApiProxy.serviceQrWallet.startTwoWayAirGapScan()
  //   },
  //   [],
  // );

  const createQrWalletAccount = useCallback(
    async ({
      walletId,
      networkId,
      indexedAccountId,
      addressCreationRequest,
    }: {
      walletId: string;
      networkId: string;
      indexedAccountId: string;
      addressCreationRequest?: IAddressCreationRequest;
    }) => {
      let byDevice: IDBDevice | undefined;
      const byWallet = await backgroundApiProxy.serviceAccount.getWallet({
        walletId,
      });
      if (byWallet.associatedDevice) {
        byDevice = await backgroundApiProxy.serviceAccount.getDevice({
          dbDeviceId: byWallet.associatedDevice,
        });
      }
      if (getAddressCreationRequestState(addressCreationRequest) !== 'active') {
        throw new OneKeyErrorScanQrCodeCancel();
      }
      const { serviceQrWallet } = backgroundApiProxy;
      const requestSignal = getAddressCreationRequestSignal(
        addressCreationRequest,
      );
      const assertCanCreate = addressCreationRequest
        ? () => {
            // The legacy child may finish before navigation restores scanner focus.
            if (
              requestSignal?.aborted ??
              getAddressCreationRequestState(addressCreationRequest) !==
                'active'
            ) {
              throw new OneKeyErrorScanQrCodeCancel();
            }
          }
        : undefined;
      const cancel = () => {
        if (addressCreationRequest) {
          void serviceQrWallet
            .cancelQrWalletAddressCreate({ owner: addressCreationRequest.id })
            .catch(() => undefined);
        }
      };
      requestSignal?.addEventListener('abort', cancel, { once: true });
      let urJson: IAirGapUrJson;
      try {
        urJson = await serviceQrWallet.prepareQrcodeWalletAddressCreate({
          walletId,
          networkId,
          indexedAccountId,
          addressCreationRequest,
          // eslint-disable-next-line onekey/no-app-locale-main-thread
          appQrCodeModalTitle: appLocale.intl.formatMessage({
            // oxlint-disable-next-line @cspell/spellchecker
            id: ETranslations.scan_to_create_an_address,
          }),
        });
      } finally {
        requestSignal?.removeEventListener('abort', cancel);
      }
      assertCanCreate?.();
      const result = await createQrWalletByUr({
        urJson,
        byDevice,
        byWallet,
        isCreateAccountAction: true,
        assertCanCreate,
        addressCreationPromiseId: addressCreationRequest?.promiseId,
      });
      return result;
    },
    [createQrWalletByUr],
  );

  return {
    createQrWallet,
    createQrWalletByUr,
    createQrWalletAccount,
  };
}

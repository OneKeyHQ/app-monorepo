import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IAuthKeyPack,
  ICloudKeyPack,
  IDeviceKeyPack,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';

export function useKeylessWallet() {
  const { isLoggedIn, loginOneKeyId, user, sendEmailOTP } = useOneKeyAuth();
  const intl = useIntl();
  const isKeylessWalletCreated = useMemo(() => {
    return !!user?.keylessWalletId;
  }, [user]);

  const generatePacks = useCallback(async () => {
    return backgroundApiProxy.serviceKeylessWallet.generateKeylessWalletPacks();
  }, []);

  const saveDevicePack = useCallback(
    async ({
      devicePack,
    }: {
      devicePack: IDeviceKeyPack;
    }): Promise<{ success: boolean; packSetInFromDevicePack: string }> => {
      return backgroundApiProxy.serviceKeylessWallet.saveDevicePackToStorage({
        devicePack,
      });
    },
    [],
  );

  const uploadCloudPack = useCallback(
    async ({
      cloudPack,
    }: {
      cloudPack: ICloudKeyPack;
    }): Promise<{
      success: boolean;
      packSetInFromCloudPack: string;
    }> => {
      // TODO cloud login check
      const { recordID } =
        await backgroundApiProxy.serviceKeylessWallet.backupCloudKeyPack({
          payload: {
            cloudKeyPack: cloudPack,
          },
          allowDuplicate: false,
        });
      return {
        success: !!recordID,
        packSetInFromCloudPack: cloudPack.packSetId,
      };
    },
    [],
  );

  const uploadAuthPack = useCallback(
    async ({
      authPack,
      packSetInFromCloudPack,
      packSetInFromDevicePack,
    }: {
      authPack: IAuthKeyPack;
      packSetInFromCloudPack: string;
      packSetInFromDevicePack: string;
    }): Promise<{ success: boolean }> => {
      const packSetIdFromAuthPack = authPack.packSetId;
      if (
        packSetIdFromAuthPack !== packSetInFromCloudPack ||
        packSetIdFromAuthPack !== packSetInFromDevicePack ||
        packSetInFromCloudPack !== packSetInFromDevicePack
      ) {
        throw new OneKeyLocalError('Pack set id mismatch');
      }

      return new Promise<{ success: boolean }>((resolve, reject) => {
        void sendEmailOTP({
          scene: EPrimeEmailOTPScene.GetKeylessWalletAuthPack,
          onCancel: () => {
            reject(new Error('User cancelled'));
          },
          onConfirm: async ({ code, uuid }) => {
            const result =
              await backgroundApiProxy.serviceKeylessWallet.uploadAuthPackToServerWithOTP(
                {
                  authPack,
                  emailOTP: code,
                  uuid,
                },
              );
            resolve(result);
          },
          description: ({ userInfo }) =>
            intl.formatMessage(
              { id: ETranslations.prime_sent_to },
              { email: userInfo.displayEmail ?? '' },
            ),
        });
      });
    },
    [intl, sendEmailOTP],
  );

  const createKeylessWalletFn = useCallback(async () => {
    const walletPacks =
      await backgroundApiProxy.serviceKeylessWallet.generateKeylessWalletPacks();
    //   walletPacks.authKeyPack
  }, []);

  const enableKeylessWalletFn = useCallback(async () => {
    if (!isKeylessWalletCreated) {
      await createKeylessWalletFn();
    }
    // TODO @franco enable keyless wallet
  }, [createKeylessWalletFn, isKeylessWalletCreated]);

  const enableKeylessWallet = useCallback(async () => {
    // check if the user is logged in
    if (!isLoggedIn) {
      await loginOneKeyId({
        onLoginSuccess: async () => {
          await enableKeylessWalletFn();
        },
      });
      return;
    }
    await enableKeylessWalletFn();
  }, [enableKeylessWalletFn, isLoggedIn, loginOneKeyId]);

  return {
    enableKeylessWallet,
    generatePacks,
    saveDevicePack, // step1
    uploadCloudPack, // step2
    uploadAuthPack, // step3
  };
}

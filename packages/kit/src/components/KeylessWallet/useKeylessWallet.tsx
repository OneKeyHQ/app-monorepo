import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { primePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  OneKeyLocalError,
  PrimeSendEmailOTPCancelError,
} from '@onekeyhq/shared/src/errors';
import { EKeylessWalletEnableScene } from '@onekeyhq/shared/src/keylessWallet/keylessWalletConsts';
import type {
  IAuthKeyPack,
  ICloudKeyPack,
  IDeviceKeyPack,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';

export function useKeylessWallet() {
  const { isLoggedIn, loginOneKeyId, sendEmailOTP } = useOneKeyAuth();
  const intl = useIntl();
  const isKeylessWalletCreated = useCallback(async () => {
    const user = await primePersistAtom.get();
    return !!user?.keylessWalletId;
  }, []);

  const generatePacks = useCallback(async () => {
    await loginOneKeyId();
    return backgroundApiProxy.serviceKeylessWallet.generateKeylessWalletPacks();
  }, [loginOneKeyId]);

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
      await loginOneKeyId();
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
          scene: EPrimeEmailOTPScene.CreateKeylessAuthShare,
          onCancel: () => {
            reject(new PrimeSendEmailOTPCancelError());
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
    [intl, loginOneKeyId, sendEmailOTP],
  );

  const getDevicePack =
    useCallback(async (): Promise<IDeviceKeyPack | null> => {
      const user = await primePersistAtom.get();
      const packSetId = user?.keylessWalletId;
      if (!packSetId) {
        throw new OneKeyLocalError(
          'You need to create the keyless wallet first.',
        );
      }
      return backgroundApiProxy.serviceKeylessWallet.getKeylessDevicePack({
        packSetId,
      });
    }, []);

  const getAuthPackFromCache =
    useCallback(async (): Promise<IAuthKeyPack | null> => {
      const user = await primePersistAtom.get();
      const packSetId = user?.keylessWalletId;
      if (!packSetId) {
        throw new OneKeyLocalError(
          'You need to create the keyless wallet first.',
        );
      }
      return backgroundApiProxy.serviceKeylessWallet.getKeylessAuthPack({
        packSetId,
      });
    }, []);

  const getAuthPackFromServer = useCallback(async (): Promise<IAuthKeyPack> => {
    await loginOneKeyId();
    const user = await primePersistAtom.get();
    const packSetId = user?.keylessWalletId;
    if (!packSetId) {
      throw new OneKeyLocalError(
        'You need to create the keyless wallet first.',
      );
    }
    return new Promise<IAuthKeyPack>((resolve, reject) => {
      void sendEmailOTP({
        scene: EPrimeEmailOTPScene.GetKeylessAuthShare,
        onCancel: () => {
          reject(new PrimeSendEmailOTPCancelError());
        },
        onConfirm: async ({ code, uuid }) => {
          const result =
            await backgroundApiProxy.serviceKeylessWallet.getAuthPackFromServerWithOTP(
              {
                packSetId,
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
  }, [intl, loginOneKeyId, sendEmailOTP]);

  /**
   * Delete the auth pack from the server for the current user's keyless wallet.
   * Throws if keylessWalletId is missing.
   */
  const deleteAuthPackFromServer = useCallback(async () => {
    await loginOneKeyId();
    return backgroundApiProxy.serviceKeylessWallet.deleteAuthPackFromServer();
  }, [loginOneKeyId]);

  const getCloudPack = useCallback(async (): Promise<ICloudKeyPack> => {
    const user = await primePersistAtom.get();
    const packSetId = user?.keylessWalletId;
    if (!packSetId) {
      throw new OneKeyLocalError(
        'You need to create the keyless wallet first.',
      );
    }
    return backgroundApiProxy.serviceKeylessWallet.getKeylessCloudPack({
      packSetId,
    });
  }, []);

  const createKeylessWalletFn = useCallback(async () => {
    const walletPacks =
      await backgroundApiProxy.serviceKeylessWallet.generateKeylessWalletPacks();
    //   walletPacks.authKeyPack
  }, []);

  const enableKeylessWalletFn = useCallback(async () => {
    if (!isKeylessWalletCreated) {
      await createKeylessWalletFn();
    }
    // TODO enable keyless wallet
  }, [createKeylessWalletFn, isKeylessWalletCreated]);

  const enableKeylessWalletSilentlyFn = useCallback(async () => {
    await loginOneKeyId();
    await timerUtils.wait(300);
    const { keylessWalletId } = await primePersistAtom.get();
    if (!keylessWalletId) {
      return;
    }
    const getCloudKeySilently = async () => {
      if (await backgroundApiProxy.serviceCloudBackupV2.supportCloudBackup()) {
        const cloudAccount =
          await backgroundApiProxy.serviceCloudBackupV2.getCloudAccountInfo();
        if (cloudAccount.userId) {
          const cloudPack = await getCloudPack();
          return cloudPack;
        }
      }
    };
    const deviceKeyPack = await getDevicePack();
    let authKeyPack = await getAuthPackFromCache();
    let cloudKeyPack: ICloudKeyPack | undefined;
    if (deviceKeyPack && authKeyPack) {
      void (deviceKeyPack && authKeyPack);
      const restoredPacks =
        await backgroundApiProxy.serviceKeylessWallet.restoreKeylessWallet({
          deviceKeyPack,
          authKeyPack,
        });
      return restoredPacks;
    }
    if (!deviceKeyPack) {
      cloudKeyPack = await getCloudKeySilently();
      if (!authKeyPack) {
        void (!deviceKeyPack && !authKeyPack);
        authKeyPack = await getAuthPackFromServer();
      } else {
        void (!deviceKeyPack && authKeyPack);
        // do nothing
      }
      if (authKeyPack && cloudKeyPack) {
        const restoredPacks =
          await backgroundApiProxy.serviceKeylessWallet.restoreKeylessWallet({
            authKeyPack,
            cloudKeyPack,
          });
        await saveDevicePack({
          devicePack: restoredPacks.packs.deviceKeyPack,
        });
        return restoredPacks;
      }
    }
    if (!authKeyPack) {
      if (deviceKeyPack) {
        void (deviceKeyPack && !authKeyPack);
        cloudKeyPack = await getCloudKeySilently();
        if (!cloudKeyPack) {
          authKeyPack = await getAuthPackFromServer();
        }
        const restoredPacks =
          await backgroundApiProxy.serviceKeylessWallet.restoreKeylessWallet({
            authKeyPack: authKeyPack || undefined,
            cloudKeyPack: cloudKeyPack || undefined,
            deviceKeyPack,
          });
        return restoredPacks;
      }
      void (!deviceKeyPack && !authKeyPack);
      // do nothing
    }
  }, [
    loginOneKeyId,
    getDevicePack,
    getAuthPackFromCache,
    getCloudPack,
    getAuthPackFromServer,
    saveDevicePack,
  ]);

  const enableKeylessWallet = useCallback(
    async ({
      fromScene = EKeylessWalletEnableScene.Onboarding,
    }: {
      fromScene?: EKeylessWalletEnableScene;
    }) => {
      await loginOneKeyId();
      if (fromScene === EKeylessWalletEnableScene.Onboarding) {
        const { userInfo } =
          await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
        if (userInfo.keylessWalletId) {
          Dialog.show({
            title: 'Keyless Wallet',
            description:
              'You already have a Keyless Wallet on this device. No need to create another one.',
            showCancelButton: false,
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_got_it,
            }),
          });
        } else {
          // do nothing
        }
      }
      // await enableKeylessWalletFn();
    },
    [intl, loginOneKeyId],
  );

  return {
    // TODO handleKeylessWalletClick
    enableKeylessWallet,
    // create flow
    generatePacks,
    saveDevicePack,
    uploadCloudPack,
    uploadAuthPack,
    // restore flow
    getDevicePack,
    getAuthPackFromCache,
    getAuthPackFromServer,
    getCloudPack,
    deleteAuthPackFromServer,
  };
}

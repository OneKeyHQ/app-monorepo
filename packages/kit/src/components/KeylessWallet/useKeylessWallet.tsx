import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { primePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  OneKeyLocalError,
  PrimeSendEmailOTPCancelError,
} from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { EKeylessWalletEnableScene } from '@onekeyhq/shared/src/keylessWallet/keylessWalletConsts';
import type {
  IAuthKeyPack,
  ICloudKeyPack,
  IDeviceKeyPack,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { EPrimeTransferDataType } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';

export function useKeylessWallet() {
  const { loginOneKeyId, sendEmailOTP } = useOneKeyAuth();
  const intl = useIntl();
  const isKeylessWalletCreated = useCallback(async () => {
    const user = await primePersistAtom.get();
    return !!user?.keylessWalletId;
  }, []);
  const navigation = useAppNavigation();

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
      packSetIdFromCloudPack,
      packSetIdFromDevicePack,
    }: {
      authPack: IAuthKeyPack;
      packSetIdFromCloudPack: string;
      packSetIdFromDevicePack: string;
    }): Promise<{ success: boolean }> => {
      await loginOneKeyId();
      const packSetIdFromAuthPack = authPack.packSetId;
      if (
        packSetIdFromAuthPack !== packSetIdFromCloudPack ||
        packSetIdFromAuthPack !== packSetIdFromDevicePack ||
        packSetIdFromCloudPack !== packSetIdFromDevicePack
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

  const isSupportCloudBackup = useCallback(async () => {
    return backgroundApiProxy.serviceCloudBackupV2.supportCloudBackup();
  }, []);

  const enableKeylessWalletSilentlyFn = useCallback(async () => {
    await loginOneKeyId();
    const { keylessWalletId } = await primePersistAtom.get();
    if (!keylessWalletId) {
      return;
    }
    return backgroundApiProxy.serviceKeylessWallet.enableKeylessWalletSilently();
  }, [loginOneKeyId]);

  const [enableKeylessWalletLoading, setEnableKeylessWalletLoading] =
    useState(false);
  const enableKeylessWalletLoadingRef = useRef(enableKeylessWalletLoading);
  enableKeylessWalletLoadingRef.current = enableKeylessWalletLoading;

  const enableKeylessWallet = useCallback(
    async ({
      fromScene = EKeylessWalletEnableScene.Onboarding,
    }: {
      fromScene?: EKeylessWalletEnableScene;
    }) => {
      if (enableKeylessWalletLoadingRef.current) {
        return;
      }
      await errorToastUtils.withErrorAutoToast(async () => {
        try {
          enableKeylessWalletLoadingRef.current = true;
          setEnableKeylessWalletLoading(true);
          await loginOneKeyId();
          const { userInfo } =
            await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
          const keylessWalletId = userInfo.keylessWalletId;

          if (fromScene === EKeylessWalletEnableScene.Onboarding) {
            if (keylessWalletId) {
              const restoredPacks = await enableKeylessWalletSilentlyFn();
              if (restoredPacks?.packs?.mnemonic) {
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
                navigation.navigate(ERootRoutes.Onboarding, {
                  screen: EOnboardingV2Routes.OnboardingV2,
                  params: {
                    screen: EOnboardingPagesV2.KeylessWalletRecovery,
                    params: {},
                  },
                });
              }
            } else if (await isSupportCloudBackup()) {
              navigation.navigate(ERootRoutes.Onboarding, {
                screen: EOnboardingV2Routes.OnboardingV2,
                params: {
                  screen: EOnboardingPagesV2.KeylessWalletCreation,
                  params: {},
                },
              });
            } else {
              // TODO add Dialog to confirm
              navigation.pushModal(EModalRoutes.PrimeModal, {
                screen: EPrimePages.PrimeTransfer,
                params: {
                  transferType: EPrimeTransferDataType.keylessWallet,
                },
              });
            }
          }
          // await enableKeylessWalletFn();
        } finally {
          setEnableKeylessWalletLoading(false);
        }
      });
    },
    [
      enableKeylessWalletSilentlyFn,
      intl,
      isSupportCloudBackup,
      loginOneKeyId,
      navigation,
    ],
  );

  return {
    // TODO handleKeylessWalletClick
    enableKeylessWallet,
    enableKeylessWalletLoading,
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

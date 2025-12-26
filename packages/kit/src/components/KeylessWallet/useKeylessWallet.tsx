import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { primePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
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
  EOnboardingV2KeylessWalletCreationMode,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { EPrimeTransferDataType } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector';
import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';

export function useKeylessWalletFeatureIsEnabled(): boolean {
  const [devSettings] = useDevSettingsPersistAtom();
  return (
    devSettings.enabled &&
    devSettings.settings?.isKeylessWalletFeatureEnabled === true
  );
}

export function useKeylessWalletMethods() {
  const { loginOneKeyId, sendEmailOTP } = useOneKeyAuth();
  const intl = useIntl();

  const navigation = useAppNavigation();

  const generatePacks = useCallback(
    async (params?: { customMnemonic?: string }) => {
      await loginOneKeyId();
      return backgroundApiProxy.serviceKeylessWallet.generateKeylessWalletPacks(
        {
          customMnemonic: params?.customMnemonic,
        },
      );
    },
    [loginOneKeyId],
  );

  const saveDevicePack = useCallback(
    async ({
      devicePack,
    }: {
      devicePack: IDeviceKeyPack;
    }): Promise<{ success: boolean; packSetIdFromDevicePack: string }> => {
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
      packSetIdFromCloudPack: string;
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
        packSetIdFromCloudPack: cloudPack.packSetId,
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
      return backgroundApiProxy.serviceKeylessWallet.getAuthPackFromCache({
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

  const receiveDevicePackByQrCode = useCallback(() => {
    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeTransfer,
      params: {
        defaultTab: 'qr-code',
        transferType: EPrimeTransferDataType.keylessWallet,
      },
    });
  }, [navigation]);

  /**
   * Initiates the process to send the DeviceKeyPack to another device using QR code pairing.
   * Navigates to the PrimeTransfer modal with the appropriate screen and params.
   */
  const sendDevicePackByQrCode = useCallback(() => {
    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeTransfer,
      params: {
        defaultTab: 'enter-link',
        transferType: EPrimeTransferDataType.keylessWallet,
      },
    });
  }, [navigation]);

  return {
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
    receiveDevicePackByQrCode,
    sendDevicePackByQrCode,
  };
}

export function useKeylessWallet() {
  const methods = useKeylessWalletMethods();
  const actions = useAccountSelectorActions();
  const { loginOneKeyId } = useOneKeyAuth();
  const isKeylessWalletCreated = useCallback(async () => {
    const user = await primePersistAtom.get();
    return !!user?.keylessWalletId;
  }, []);
  const navigation = useAppNavigation();
  const intl = useIntl();

  const createKeylessWalletFn = useCallback(async () => {
    await backgroundApiProxy.serviceKeylessWallet.generateKeylessWalletPacks();
  }, []);

  const _enableKeylessWalletFn = useCallback(async () => {
    if (!isKeylessWalletCreated) {
      await createKeylessWalletFn();
    }
    // TODO enable keyless wallet
  }, [createKeylessWalletFn, isKeylessWalletCreated]);

  const isSupportCloudBackup = useCallback(async () => {
    return backgroundApiProxy.serviceCloudBackupV2.supportCloudBackup();
  }, []);

  const enableKeylessWalletSilentlyFn = useCallback(
    async ({
      restoreAuthPackFromServer,
    }: {
      restoreAuthPackFromServer?: boolean;
    } = {}) => {
      await loginOneKeyId();
      const { keylessWalletId } = await primePersistAtom.get();
      if (!keylessWalletId) {
        return;
      }
      return backgroundApiProxy.serviceKeylessWallet.enableKeylessWalletSilently(
        {
          restoreAuthPackFromServer,
        },
      );
    },
    [loginOneKeyId],
  );

  const [enableKeylessWalletLoading, setEnableKeylessWalletLoading] =
    useState(false);
  const enableKeylessWalletLoadingRef = useRef(enableKeylessWalletLoading);
  enableKeylessWalletLoadingRef.current = enableKeylessWalletLoading;

  const enableKeylessWallet = useCallback(
    async ({
      fromScene = EKeylessWalletEnableScene.Onboarding,
      restoreAuthPackFromServer = false,
    }: {
      fromScene?: EKeylessWalletEnableScene;
      restoreAuthPackFromServer?: boolean;
    } = {}) => {
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
              const restoredPacks = await enableKeylessWalletSilentlyFn({
                restoreAuthPackFromServer,
              });

              // TODO remove mnemonic from method return
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
                // TODO coreApi stringify ERROR
                void actions.current.createKeylessWallet({
                  packSetId: restoredPacks?.packs?.deviceKeyPack?.packSetId,
                });
              } else {
                navigation.navigate(ERootRoutes.Onboarding, {
                  screen: EOnboardingV2Routes.OnboardingV2,
                  params: {
                    screen: EOnboardingPagesV2.KeylessWalletCreation,
                    params: {
                      mode: EOnboardingV2KeylessWalletCreationMode.Restore,
                    },
                  },
                });
              }
            } else if (await isSupportCloudBackup()) {
              navigation.navigate(ERootRoutes.Onboarding, {
                screen: EOnboardingV2Routes.OnboardingV2,
                params: {
                  screen: EOnboardingPagesV2.KeylessWalletCreation,
                  params: {
                    mode: EOnboardingV2KeylessWalletCreationMode.Create,
                  },
                },
              });
            } else {
              Dialog.show({
                title: 'Keyless Wallet',
                description:
                  'Please first create your Keyless Wallet on the mobile app or Mac app, then continue on this device.',
                showCancelButton: false,
                onConfirmText: intl.formatMessage({
                  id: ETranslations.global_got_it,
                }),
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
      actions,
      enableKeylessWalletSilentlyFn,
      intl,
      isSupportCloudBackup,
      loginOneKeyId,
      navigation,
    ],
  );

  return {
    ...methods,
    // TODO handleKeylessWalletClick
    enableKeylessWallet,
    enableKeylessWalletLoading,
  };
}

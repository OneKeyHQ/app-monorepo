import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { primePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  devSettingsPersistAtom,
  useDevSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  OneKeyLocalError,
  PrimeSendEmailOTPCancelError,
} from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EKeylessFinalizeAction,
  EKeylessWalletEnableScene,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletConsts';
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
  EOnboardingV2OneKeyIDLoginMode,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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

export const keylessOnboardingCache = new cacheUtils.LRUCache<string, string>({
  max: 1000,
  ttl: timerUtils.getTimeDurationMs({ minute: 3 }),
  ttlAutopurge: true,
});

async function keylessOnboardingCacheGetAndDelete(
  key: string,
  options: {
    skipDelete?: boolean;
  } = {},
) {
  const token = keylessOnboardingCache.get(key);
  if (!options?.skipDelete) {
    keylessOnboardingCache.delete(key);
  }
  if (!token) {
    return '';
  }
  return backgroundApiProxy.servicePassword.decodeSensitiveText({
    encodedText: token,
  });
}

async function keylessOnboardingCacheSet(key: string, value: string) {
  keylessOnboardingCache.set(
    key,
    await backgroundApiProxy.servicePassword.encodeSensitiveText({
      text: value,
    }),
  );
}

async function cacheKeylessOnboardingToken({ token }: { token: string }) {
  await keylessOnboardingCacheSet('socialLoginToken', token);
}

async function getKeylessOnboardingToken(options?: { skipDelete?: boolean }) {
  const token = keylessOnboardingCacheGetAndDelete('socialLoginToken', options);
  return token;
}

async function cacheKeylessOnboardingPin({ pin }: { pin: string }) {
  await keylessOnboardingCacheSet('onboardingPin', pin);
}

async function getKeylessOnboardingPin(options?: { skipDelete?: boolean }) {
  const pin = keylessOnboardingCacheGetAndDelete('onboardingPin', options);
  return pin;
}

async function cacheKeylessOnboardingCustomMnemonic({
  customMnemonic,
}: {
  customMnemonic: string;
}) {
  const devSettings = await devSettingsPersistAtom.get();
  if (devSettings.enabled) {
    await keylessOnboardingCacheSet('customMnemonic', customMnemonic);
  }
}

async function getKeylessOnboardingCustomMnemonic(options?: {
  skipDelete?: boolean;
}) {
  const devSettings = await devSettingsPersistAtom.get();
  if (devSettings.enabled) {
    const customMnemonic = keylessOnboardingCacheGetAndDelete(
      'customMnemonic',
      options,
    );
    return customMnemonic;
  }
}

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  globalThis.$$keylessOnboardingCache = keylessOnboardingCache;
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

  const handleKeylessOnboardingTimeout = useCallback(() => {
    Dialog.show({
      title: 'Keyless Wallet',
      description: 'Keyless Wallet onboarding timed out. Please try again.',
      showCancelButton: false,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_got_it,
      }),
    });
    throw new OneKeyLocalError('Keyless Wallet onboarding timed out');
  }, [intl]);

  // Renamed function, checks if KeylessWallet exists locally
  const checkKeylessWalletLocalExistence = useCallback(async () => {
    if (enableKeylessWalletLoadingRef.current) {
      return;
    }
    await errorToastUtils.withErrorAutoToast(async () => {
      try {
        enableKeylessWalletLoadingRef.current = true;
        setEnableKeylessWalletLoading(true);

        const exists =
          await backgroundApiProxy.serviceAccount.isKeylessWalletExists();
        if (exists) {
          Dialog.show({
            title: 'Keyless Wallet',
            // TODO @franco 本地已经添加无私钥钱包，如果需要使用其他无私钥钱包，请先删除当前钱包
            description:
              'A Keyless Wallet is already added. To use another Keyless Wallet, please delete the current one first.',
            showCancelButton: false,
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_got_it,
            }),
          });
        } else {
          navigation.navigate(ERootRoutes.Onboarding, {
            screen: EOnboardingV2Routes.OnboardingV2,
            params: {
              screen: EOnboardingPagesV2.OneKeyIDLogin,
              params: {
                mode: EOnboardingV2OneKeyIDLoginMode.CreateOrImportKeylessWallet,
              },
            },
          });
        }
      } finally {
        setEnableKeylessWalletLoading(false);
      }
    });
  }, [intl, navigation]);

  const checkKeylessWalletInitedOnServer = useCallback(
    async ({ token }: { token: string }) => {
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }
      const backendShareInfo =
        await backgroundApiProxy.serviceKeylessWallet.apiGetKeylessBackendShare(
          {
            token,
          },
        );
      const isInited = !!backendShareInfo;
      await cacheKeylessOnboardingToken({ token });
      if (isInited) {
        navigation.push(EOnboardingPagesV2.VerifyPin);
      } else {
        navigation.push(EOnboardingPagesV2.CreatePin);
      }
    },
    [handleKeylessOnboardingTimeout, navigation],
  );

  const finalizeKeylessWalletV2 = useCallback(
    async ({ action }: { action: EKeylessFinalizeAction }) => {
      const token = await getKeylessOnboardingToken();
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }
      const pin = await getKeylessOnboardingPin();
      if (!pin) {
        handleKeylessOnboardingTimeout();
        return;
      }
      if (!action) {
        Dialog.show({
          title: 'Keyless Wallet',
          description: 'EKeylessFinalizeAction is required',
          showCancelButton: false,
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_got_it,
          }),
        });
        return;
      }
      let mnemonic = '';
      if (action === EKeylessFinalizeAction.Create) {
        const customMnemonic = await getKeylessOnboardingCustomMnemonic();
        ({ mnemonic } =
          await backgroundApiProxy.serviceKeylessWallet.initKeylessWalletToServer(
            {
              token,
              pin,
              customMnemonic,
            },
          ));
      }
      if (action === EKeylessFinalizeAction.Restore) {
        ({ mnemonic } =
          await backgroundApiProxy.serviceKeylessWallet.restoreKeylessWalletFromServer(
            {
              token,
              pin,
            },
          ));
      }
      navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
        mnemonic,
        isWalletBackedUp: true,
        isKeylessWallet: true,
      });
    },
    [navigation, handleKeylessOnboardingTimeout, intl],
  );

  const confirmKeylessOnboardingPin = useCallback(
    async ({
      pin,
      action,
    }: {
      pin: string;
      action: EKeylessFinalizeAction;
    }) => {
      await cacheKeylessOnboardingPin({ pin });
      const hasCachedPassword =
        await backgroundApiProxy.servicePassword.hasCachedPassword();
      if (hasCachedPassword) {
        await finalizeKeylessWalletV2({ action });
      } else {
        navigation.push(EOnboardingPagesV2.CreatePasscode, { action });
      }
    },
    [finalizeKeylessWalletV2, navigation],
  );

  const verifyKeylessOnboardingPin = useCallback(
    async ({ pin }: { pin: string }) => {
      const token = await getKeylessOnboardingToken({ skipDelete: true });
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }
      await backgroundApiProxy.serviceKeylessWallet.apiVerifyKeylessJuiceboxPin(
        {
          token,
          pin,
        },
      );
      await cacheKeylessOnboardingToken({ token });
      await confirmKeylessOnboardingPin({
        pin,
        action: EKeylessFinalizeAction.Restore,
      });
    },
    [confirmKeylessOnboardingPin, handleKeylessOnboardingTimeout],
  );

  return {
    ...methods,
    // TODO handleKeylessWalletClick
    enableKeylessWallet,
    enableKeylessWalletLoading,
    checkKeylessWalletLocalExistence, // step1
    checkKeylessWalletInitedOnServer, // step2
    confirmKeylessOnboardingPin, // step3
    verifyKeylessOnboardingPin,
    finalizeKeylessWalletV2, // step4
    keylessOnboardingCache,
    cacheKeylessOnboardingPin,
    getKeylessOnboardingPin,
    handleKeylessOnboardingTimeout,
    cacheKeylessOnboardingCustomMnemonic,
    getKeylessOnboardingCustomMnemonic,
  };
}

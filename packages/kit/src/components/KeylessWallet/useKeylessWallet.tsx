import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { primePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  devSettingsPersistAtom,
  useDevSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
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
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector';
import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';

export function useKeylessWalletFeatureIsEnabled(): boolean {
  // const [devSettings] = useDevSettingsPersistAtom();
  // return (
  //   devSettings.enabled &&
  //   devSettings.settings?.isKeylessWalletFeatureEnabled === true
  // );
  return true;
}

export function useKeylessWalletExistsLocal(): boolean {
  const isKeylessWalletEnabled = useKeylessWalletFeatureIsEnabled();
  const { result } = usePromiseResult(async () => {
    if (!isKeylessWalletEnabled) {
      return false;
    }
    return backgroundApiProxy.serviceAccount.isKeylessWalletExistsLocal();
  }, [isKeylessWalletEnabled]);
  return result ?? false;
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

async function cacheKeylessOnboardingToken({
  token,
  refreshToken,
}: {
  token: string;
  refreshToken?: string;
}) {
  await keylessOnboardingCacheSet('socialLoginToken', token);
  if (refreshToken) {
    await keylessOnboardingCacheSet('socialLoginRefreshToken', refreshToken);
  }
}

async function getKeylessOnboardingToken(options?: { skipDelete?: boolean }) {
  const token = keylessOnboardingCacheGetAndDelete('socialLoginToken', options);
  return token;
}

async function getKeylessOnboardingRefreshToken(options?: {
  skipDelete?: boolean;
}) {
  const refreshToken = keylessOnboardingCacheGetAndDelete(
    'socialLoginRefreshToken',
    options,
  );
  return refreshToken;
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
  const { loginOneKeyId, signInWithSocialLogin } = useOneKeyAuth();
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
    // TODO @franco 创建无私钥钱包超时提示（安全考虑，社交账户登录后 3 分钟内未完成创建，则提示超时，需重新登录）
    Dialog.show({
      title: 'Keyless Wallet',
      description:
        'For security reasons, your keyless wallet creation session has expired. Please log in again with your social account to continue.',
      showCancelButton: false,
      // TODO return to OneKeyIDLoginPage
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_got_it,
      }),
      onCancel: () => {
        keylessOnboardingCache.clear();
        navigation.popStack();
      },
      onClose: () => {
        keylessOnboardingCache.clear();
        navigation.popStack();
      },
      onConfirm: () => {
        keylessOnboardingCache.clear();
        navigation.popStack();
      },
    });
    throw new OneKeyLocalError('Keyless Wallet onboarding timed out');
  }, [intl, navigation]);

  const checkKeylessWalletCreatedOnServer = useCallback(
    async ({
      token,
      refreshToken,
      mode,
    }: {
      token: string;
      refreshToken?: string;
      mode?: EOnboardingV2OneKeyIDLoginMode;
    }) => {
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }
      await cacheKeylessOnboardingToken({ token, refreshToken });

      // ResetPin: skip check, go to CreatePin
      if (mode === EOnboardingV2OneKeyIDLoginMode.KeylessResetPin) {
        // TODO check if keyless wallet matched with ownerId
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.CreatePin,
            params: {
              action: EKeylessFinalizeAction.ResetPin,
            },
          },
        });
        return;
      }

      // VerifyPinOnly: skip check, go to VerifyPin
      if (mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly) {
        // TODO check if keyless wallet matched with ownerId
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.VerifyPin,
            params: {
              mode: EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly,
            },
          },
        });
        return;
      }

      // Default: check wallet existence and navigate accordingly
      const isCreated =
        await backgroundApiProxy.serviceKeylessWallet.isKeylessWalletCreatedOnServer(
          {
            token,
          },
        );
      if (isCreated) {
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.VerifyPin,
            params: {
              mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
            },
          },
        });
      } else {
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.CreatePin,
          },
        });
      }
    },
    [handleKeylessOnboardingTimeout, navigation],
  );

  // goToOneKeyIDLoginPageForKeylessWallet
  const goToOneKeyIDLoginPageForKeylessWallet = useCallback(
    async ({ mode }: { mode: EOnboardingV2OneKeyIDLoginMode }) => {
      if (
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessResetPin ||
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly
      ) {
        // Get keyless wallet to extract ownerId from keylessDetailsInfo
        let keylessWallet;
        try {
          keylessWallet =
            await backgroundApiProxy.serviceAccount.getKeylessWallet();
        } catch (error) {
          // Continue to navigation if getKeylessWallet fails
        }
        const ownerId = keylessWallet?.keylessDetailsInfo?.keylessOwnerId || '';

        if (keylessWallet && ownerId) {
          // Try to refresh session if refreshToken is valid
          let refreshResult;
          try {
            refreshResult =
              await backgroundApiProxy.serviceKeylessWallet.tryRefreshTokenFromStorage(
                { ownerId },
              );
          } catch (error) {
            // Continue to navigation if refresh fails
          }

          if (
            refreshResult &&
            refreshResult?.accessToken &&
            refreshResult?.refreshToken
          ) {
            // Refresh successful, proceed with checkKeylessWalletCreatedOnServer
            await checkKeylessWalletCreatedOnServer({
              token: refreshResult.accessToken,
              refreshToken: refreshResult.refreshToken,
              mode,
            });
            return;
          }
        }
      }

      navigation.navigate(ERootRoutes.Onboarding, {
        screen: EOnboardingV2Routes.OnboardingV2,
        params: {
          screen: EOnboardingPagesV2.OneKeyIDLogin,
          params: {
            mode,
          },
        },
      });
    },
    [navigation, checkKeylessWalletCreatedOnServer],
  );

  // Renamed function, checks if KeylessWallet exists locally
  const checkKeylessWalletLocalExistence = useCallback(
    async ({
      signInProvider,
    }: {
      signInProvider?: EOAuthSocialLoginProvider;
    } = {}) => {
      if (enableKeylessWalletLoadingRef.current) {
        return;
      }
      await errorToastUtils.withErrorAutoToast(async () => {
        try {
          enableKeylessWalletLoadingRef.current = true;
          setEnableKeylessWalletLoading(true);

          const exists =
            await backgroundApiProxy.serviceAccount.isKeylessWalletExistsLocal();
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
            if (signInProvider) {
              const result = await signInWithSocialLogin(signInProvider);
              if (result?.session?.accessToken) {
                await checkKeylessWalletCreatedOnServer({
                  token: result.session.accessToken,
                  refreshToken: result.session.refreshToken,
                  mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
                });
              }
              return;
            }
            await goToOneKeyIDLoginPageForKeylessWallet({
              mode: EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore,
            });
          }
        } finally {
          setEnableKeylessWalletLoading(false);
        }
      });
    },
    [
      checkKeylessWalletCreatedOnServer,
      goToOneKeyIDLoginPageForKeylessWallet,
      intl,
      signInWithSocialLogin,
    ],
  );

  const finalizeKeylessWalletV2 = useCallback(
    async ({ action }: { action: EKeylessFinalizeAction }) => {
      const token = await getKeylessOnboardingToken();
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }
      const refreshToken = await getKeylessOnboardingRefreshToken();
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

      // Handle ResetPin action
      if (action === EKeylessFinalizeAction.ResetPin) {
        await backgroundApiProxy.serviceKeylessWallet.resetKeylessWalletPin({
          token,
          refreshToken,
          newPin: pin,
        });
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.NewPinCreated,
          },
        });
        return;
      }

      let mnemonic = '';
      let ownerId = '';
      let keylessDetailsInfo;
      if (action === EKeylessFinalizeAction.Create) {
        const result =
          await backgroundApiProxy.serviceKeylessWallet.createKeylessWalletToServer(
            {
              token,
              refreshToken,
              pin,
              customMnemonic: await getKeylessOnboardingCustomMnemonic(),
            },
          );
        mnemonic = result.mnemonic;
        ownerId = result.ownerId;
        keylessDetailsInfo = result.keylessDetailsInfo;
      }
      if (action === EKeylessFinalizeAction.Restore) {
        const result =
          await backgroundApiProxy.serviceKeylessWallet.restoreKeylessWalletFromServer(
            {
              token,
              refreshToken,
              pin,
            },
          );
        mnemonic = result.mnemonic;
        ownerId = result.ownerId;
        keylessDetailsInfo = result.keylessDetailsInfo;
      }
      navigation.navigate(ERootRoutes.Onboarding, {
        screen: EOnboardingV2Routes.OnboardingV2,
        params: {
          screen: EOnboardingPagesV2.FinalizeWalletSetup,
          params: {
            mnemonic,
            isWalletBackedUp: true,
            isKeylessWallet: true,
            keylessOwnerId: ownerId,
            keylessDetailsInfo,
          },
        },
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
        navigation.navigate(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.CreatePasscode,
            params: { action },
          },
        });
      }
    },
    [finalizeKeylessWalletV2, navigation],
  );

  const verifyKeylessOnboardingPin = useCallback(
    async ({
      pin,
      mode,
    }: {
      pin: string;
      mode?: EOnboardingV2OneKeyIDLoginMode;
    }) => {
      const token = await getKeylessOnboardingToken({ skipDelete: true });
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }
      const refreshToken = await getKeylessOnboardingRefreshToken({
        skipDelete: true,
      });
      await backgroundApiProxy.serviceKeylessWallet.apiVerifyKeylessJuiceboxPin(
        {
          token,
          pin,
          refreshToken,
          mode,
        },
      );

      // VerifyPinOnly: just verify, show success dialog and close modal
      if (mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly) {
        navigation.popStack();

        Dialog.show({
          title: 'PIN Verified',
          description: 'PIN verified successfully',
          showCancelButton: false,
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_got_it,
          }),
          onConfirm: () => {
            //
          },
        });
        return;
      }

      // Default: continue with restore flow
      await cacheKeylessOnboardingToken({ token, refreshToken });
      await confirmKeylessOnboardingPin({
        pin,
        action: EKeylessFinalizeAction.Restore,
      });
    },
    [
      confirmKeylessOnboardingPin,
      handleKeylessOnboardingTimeout,
      intl,
      navigation,
    ],
  );

  return {
    ...methods,
    // TODO handleKeylessWalletClick
    enableKeylessWallet,
    enableKeylessWalletLoading,
    goToOneKeyIDLoginPageForKeylessWallet,
    checkKeylessWalletLocalExistence, // step1
    checkKeylessWalletCreatedOnServer, // step2 (handles all modes: default, ResetPin, VerifyPinOnly)
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

import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Dialog,
  SizableText,
  Toast,
  YStack,
  rootNavigationRef,
} from '@onekeyhq/components';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  primePersistAtom,
  useDevSettingsPersistAtom,
  useKeylessLastCancelVerifyPinTimeAtom,
  useKeylessPinConfirmStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { devSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  IncorrectPinError,
  OneKeyLocalError,
  PrimeSendEmailOTPCancelError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  ERootRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import {
  EOnboardingPagesV2,
  EOnboardingV2KeylessWalletCreationMode,
  EOnboardingV2OneKeyIDLoginMode,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EPrimeTransferDataType } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';

import {
  showAppleIDMismatchDialog,
  showGoogleDriveMismatchDialog,
} from './AccountMismatchDialog';
import {
  getPromotedSameEmailAccountStatusAfterAutoRetryRateLimit,
  isKeylessSameEmailAutoRetryRateLimitError,
} from './sameEmailAccountStatusUtils';

import type { IKeylessSameEmailAccountStatus } from './sameEmailAccountStatusUtils';

export function useKeylessWalletFeatureIsEnabled(): boolean {
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
  ttl: timerUtils.getTimeDurationMs({ minute: 8 }),
  ttlAutopurge: true,
});

async function keylessOnboardingCacheGet(key: string) {
  const token = keylessOnboardingCache.get(key);
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

async function getKeylessOnboardingToken() {
  const token = keylessOnboardingCacheGet('socialLoginToken');
  return token;
}

async function getKeylessOnboardingRefreshToken() {
  const refreshToken = keylessOnboardingCacheGet('socialLoginRefreshToken');
  return refreshToken;
}

async function cacheKeylessOnboardingPin({ pin }: { pin: string }) {
  await keylessOnboardingCacheSet('onboardingPin', pin);
}

export async function getKeylessOnboardingPin() {
  const pin = keylessOnboardingCacheGet('onboardingPin');
  return pin;
}

async function cacheKeylessOnboardingSameEmailAccountStatus({
  status,
}: {
  status: IKeylessSameEmailAccountStatus;
}) {
  await keylessOnboardingCacheSet(
    'sameEmailAccountStatus',
    JSON.stringify(status),
  );
}

export async function getKeylessOnboardingSameEmailAccountStatus(): Promise<IKeylessSameEmailAccountStatus> {
  const raw = await keylessOnboardingCacheGet('sameEmailAccountStatus');
  if (!raw) {
    return {
      isSameEmailAccountAtOldVersion: false,
    };
  }

  try {
    const status = JSON.parse(raw) as IKeylessSameEmailAccountStatus;
    return {
      isSameEmailAccountAtOldVersion: !!status?.isSameEmailAccountAtOldVersion,
      retryProvider: status?.retryProvider,
      currentProvider: status?.currentProvider,
    };
  } catch {
    return {
      isSameEmailAccountAtOldVersion: false,
    };
  }
}

async function promoteKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
  status,
}: {
  status: IKeylessSameEmailAccountStatus;
}) {
  const nextStatus =
    getPromotedSameEmailAccountStatusAfterAutoRetryRateLimit(status);

  if (!nextStatus) {
    return;
  }

  await cacheKeylessOnboardingSameEmailAccountStatus({
    status: nextStatus,
  });
}

async function shouldPromoteKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
  token,
  error,
}: {
  token: string;
  error: unknown;
}) {
  if (!isKeylessSameEmailAutoRetryRateLimitError(error)) {
    return false;
  }

  try {
    const result =
      await backgroundApiProxy.serviceKeylessWallet.apiCheckRateLimitStatus({
        token,
      });

    return result.isRateLimited && result.retryAfterSeconds > 0;
  } catch {
    return false;
  }
}

async function syncKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
  token,
  error,
  status,
}: {
  token: string;
  error: unknown;
  status: IKeylessSameEmailAccountStatus;
}) {
  try {
    if (
      await shouldPromoteKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
        token,
        error,
      })
    ) {
      await promoteKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
        status,
      });
    }
  } catch (syncError) {
    console.error(
      'Failed to sync keyless same-email retry provider after rate limit:',
      syncError,
    );
  }
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

async function getKeylessOnboardingCustomMnemonic() {
  const devSettings = await devSettingsPersistAtom.get();
  if (devSettings.enabled) {
    const customMnemonic = keylessOnboardingCacheGet('customMnemonic');
    return customMnemonic;
  }
}

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  globalThis.$$keylessOnboardingCache = keylessOnboardingCache;
}

export function useKeylessWallet() {
  const methods = useKeylessWalletMethods();
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
                // void actions.current.createKeylessWallet({
                //   packSetId: restoredPacks?.packs?.deviceKeyPack?.packSetId,
                // });
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
      enableKeylessWalletSilentlyFn,
      intl,
      isSupportCloudBackup,
      loginOneKeyId,
      navigation,
    ],
  );

  const handleKeylessOnboardingTimeout = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.create_keyless_wallet_session_expired,
      }),
      description: intl.formatMessage({
        id: ETranslations.create_keyless_wallet_session_expired_desc,
      }),
      showCancelButton: false,
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

      // ResetPin or VerifyPinOnly: validate token matches local keyless wallet
      const checkLoginMatchedKeylessWallet = async () => {
        if (
          mode === EOnboardingV2OneKeyIDLoginMode.KeylessResetPin ||
          mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly
        ) {
          const { isValid } =
            await backgroundApiProxy.serviceKeylessWallet.validateTokenMatchesKeylessWallet(
              { token },
            );
          if (!isValid) {
            // Get keyless wallet provider type to determine which dialog to show
            const keylessWallet =
              await backgroundApiProxy.serviceAccount.getKeylessWallet();
            const keylessProvider =
              keylessWallet?.keylessDetailsInfo?.keylessProvider;

            // Platform-specific account mismatch handling based on provider type
            const isAndroidWithGoogle =
              platformEnv.isNativeAndroid &&
              keylessProvider === EOAuthSocialLoginProvider.Google;
            const isIOSWithApple =
              platformEnv.isNativeIOS &&
              keylessProvider === EOAuthSocialLoginProvider.Apple;

            if (isAndroidWithGoogle) {
              // Android + Google: Show dialog with Google logout option
              void showGoogleDriveMismatchDialog({ intl });
            } else if (isIOSWithApple) {
              // iOS + Apple: Show dialog with Apple ID switching instructions
              void showAppleIDMismatchDialog({ intl });
            } else {
              // Other cases: Show Toast
              Toast.error({
                title: intl.formatMessage({
                  id: ETranslations.keyless_wallet_verify_pin_account_mismatch,
                }),
                message: intl.formatMessage({
                  id: ETranslations.keyless_wallet_verify_pin_account_mismatch_desc,
                }),
              });
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
            throw new OneKeyLocalError(
              intl.formatMessage({
                id: ETranslations.keyless_wallet_verify_pin_account_mismatch_desc,
              }),
            );
          }
        }
      };
      await checkLoginMatchedKeylessWallet();
      await cacheKeylessOnboardingSameEmailAccountStatus({
        status: {
          isSameEmailAccountAtOldVersion: false,
        },
      });

      if (mode === EOnboardingV2OneKeyIDLoginMode.KeylessResetPin) {
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

      if (mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly) {
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
        await cacheKeylessOnboardingSameEmailAccountStatus({
          status: {
            isSameEmailAccountAtOldVersion: false,
          },
        });
        const sameEmailAccountStatus =
          await backgroundApiProxy.serviceKeylessWallet.apiGetKeylessSameEmailAccountStatus(
            {
              token,
            },
          );
        await cacheKeylessOnboardingSameEmailAccountStatus({
          status: sameEmailAccountStatus,
        });
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
    [handleKeylessOnboardingTimeout, intl, navigation],
  );

  // goToOneKeyIDLoginPageForKeylessWallet
  const goToOneKeyIDLoginPageForKeylessWallet = useCallback(
    async ({ mode }: { mode: EOnboardingV2OneKeyIDLoginMode }) => {
      let keylessProvider: EOAuthSocialLoginProvider | undefined;

      if (
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessResetPin ||
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly
      ) {
        // Get keyless wallet to extract ownerId and provider from keylessDetailsInfo
        let keylessWallet;
        try {
          keylessWallet =
            await backgroundApiProxy.serviceAccount.getKeylessWallet();
        } catch (_error) {
          // Continue to navigation if getKeylessWallet fails
        }
        const ownerId = keylessWallet?.keylessDetailsInfo?.keylessOwnerId || '';
        keylessProvider = keylessWallet?.keylessDetailsInfo?.keylessProvider;

        if (keylessWallet && ownerId) {
          // Try to refresh session if refreshToken is valid
          let refreshResult;
          try {
            refreshResult =
              await backgroundApiProxy.serviceKeylessWallet.tryRefreshTokenFromStorage(
                { ownerId },
              );
          } catch (_error) {
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
            provider: keylessProvider,
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
              title: intl.formatMessage({
                id: ETranslations.keyless_wallet_is_enabled,
              }),
              description: intl.formatMessage({
                id: ETranslations.keyless_wallet_is_enabled_desc,
              }),
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
      let loadingDialog: IDialogInstance | undefined;
      try {
        loadingDialog = Dialog.loading({
          title: intl.formatMessage({
            id: ETranslations.global_preparing,
          }),
        });
        await timerUtils.wait(600);
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
      } finally {
        // Wait for current page animations (e.g. HeightTransition in
        // VerifyPin) to settle before navigating. The delay runs while
        // the loading dialog is still visible so the user sees no gap.
        // React Navigation's default Android transition is ~300ms;
        // matching it prevents worklet serialization collisions that
        // cause SIGSEGV on Android with Fabric/New Architecture.
        await timerUtils.wait(300);
        await loadingDialog?.close?.();
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
            shouldAutoResetKeylessPinAfterRestore:
              action === EKeylessFinalizeAction.Restore
                ? (await getKeylessOnboardingSameEmailAccountStatus())
                    .isSameEmailAccountAtOldVersion
                : false,
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
      dangerousRetryByFixedProvider,
    }: {
      pin: string;
      mode?: EOnboardingV2OneKeyIDLoginMode;
      dangerousRetryByFixedProvider: boolean;
    }) => {
      const token = await getKeylessOnboardingToken();
      if (!token) {
        handleKeylessOnboardingTimeout();
        return;
      }
      const refreshToken = await getKeylessOnboardingRefreshToken();
      const sameEmailAccountStatus =
        mode === EOnboardingV2OneKeyIDLoginMode.KeylessCreateOrRestore
          ? await getKeylessOnboardingSameEmailAccountStatus()
          : {
              isSameEmailAccountAtOldVersion: false,
            };

      try {
        await backgroundApiProxy.serviceKeylessWallet.apiVerifyKeylessJuiceboxPin(
          {
            token,
            pin,
            refreshToken,
            mode,
            dangerousRetryByFixedProvider,
            providerOverride: dangerousRetryByFixedProvider
              ? undefined
              : sameEmailAccountStatus.currentProvider,
          },
        );
      } catch (error) {
        const isPinErrorByInstance = error instanceof IncorrectPinError;
        const isPinErrorByClassName = errorUtils.isErrorByClassName({
          error,
          className: EOneKeyErrorClassNames.IncorrectPinError,
        });
        const isPinError = isPinErrorByInstance || isPinErrorByClassName;

        if (
          isPinError &&
          sameEmailAccountStatus.isSameEmailAccountAtOldVersion &&
          sameEmailAccountStatus.retryProvider &&
          !dangerousRetryByFixedProvider
        ) {
          try {
            await backgroundApiProxy.serviceKeylessWallet.apiVerifyKeylessJuiceboxPin(
              {
                token,
                pin,
                refreshToken,
                mode,
                dangerousRetryByFixedProvider: false,
                providerOverride: sameEmailAccountStatus.retryProvider,
              },
            );
          } catch (retryError) {
            void syncKeylessOnboardingSameEmailRetryProviderAfterRateLimit({
              token,
              error: retryError,
              status: sameEmailAccountStatus,
            });
            throw retryError;
          }
        } else {
          throw error;
        }
      }

      // VerifyPinOnly: just verify, show success toast and close modal
      if (mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly) {
        navigation.popStack();
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.keyless_wallet_pin_verified_successfully,
          }),
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
    getKeylessOnboardingToken,
    handleKeylessOnboardingTimeout,
    cacheKeylessOnboardingCustomMnemonic,
    getKeylessOnboardingCustomMnemonic,
  };
}

let isPinReminderDialogShowing = false;

export function useVerifyKeylessPinChecking() {
  const { goToOneKeyIDLoginPageForKeylessWallet } = useKeylessWallet();
  const intl = useIntl();
  const [keylessPinConfirmStatus] = useKeylessPinConfirmStatusAtom();
  const [keylessLastCancelVerifyPinTime, setKeylessLastCancelVerifyPinTime] =
    useKeylessLastCancelVerifyPinTimeAtom();
  const [devSettings] = useDevSettingsPersistAtom();

  const cancelVerifyPin = useCallback(
    async (ownerId: string | 'CURRENT_KEYLESS_WALLET') => {
      await backgroundApiProxy.serviceKeylessWallet.cancelVerifyPin({
        ownerId,
      });

      // save last cancel verify pin time
      setKeylessLastCancelVerifyPinTime(Date.now());
    },
    [setKeylessLastCancelVerifyPinTime],
  );

  const verifyKeylessPinChecking = useCallback(
    async (options: { forceVerify?: boolean; wallet: IDBWallet }) => {
      if (isPinReminderDialogShowing) {
        return;
      }

      const getCurrentActiveWallet = async () => {
        try {
          const selectedAccount =
            await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount(
              {
                sceneName: EAccountSelectorSceneName.home,
                num: 0,
              },
            );
          if (!selectedAccount?.walletId) {
            return undefined;
          }
          return await backgroundApiProxy.serviceAccount.getWallet({
            walletId: selectedAccount.walletId,
          });
        } catch {
          return undefined;
        }
      };

      const activeWallet = (await getCurrentActiveWallet()) ?? options.wallet;
      if (activeWallet?.isKeyless) {
        const ownerId = activeWallet?.keylessDetailsInfo?.keylessOwnerId;
        if (!ownerId) {
          return;
        }

        // skip if last cancel verify pin time is less than 12 hour (skip in dev mode)
        if (!devSettings.enabled) {
          const TWELVE_HOURS_IN_MS = timerUtils.getTimeDurationMs({ hour: 12 });
          if (
            keylessLastCancelVerifyPinTime &&
            Date.now() - keylessLastCancelVerifyPinTime < TWELVE_HOURS_IN_MS &&
            !options.forceVerify
          ) {
            return;
          }
        }

        let shouldChecking = true;
        if (
          keylessPinConfirmStatus?.socialProvider ===
            activeWallet?.keylessDetailsInfo?.keylessProvider &&
          keylessPinConfirmStatus?.socialUserIdHash ===
            activeWallet?.keylessDetailsInfo?.socialUserIdHash &&
          keylessPinConfirmStatus?.remindTime &&
          keylessPinConfirmStatus?.remindTime > Date.now()
        ) {
          shouldChecking = false;
        }
        if (!shouldChecking && !options.forceVerify) {
          return;
        }
        const checkShouldVerifyPin = async () => {
          const accessToken =
            await backgroundApiProxy.serviceKeylessWallet.getKeylessCachedAccessToken(
              { ownerId },
            );
          let shouldVerifyPin = false;
          if (accessToken) {
            void backgroundApiProxy.serviceKeylessWallet.fixKeylessWalletAvatar(
              {
                wallet: activeWallet,
                accessToken,
              },
            );
          }
          if (accessToken) {
            const { shouldRemind } =
              await backgroundApiProxy.serviceKeylessWallet.apiGetPinConfirmStatus(
                {
                  token: accessToken,
                },
              );
            shouldVerifyPin = shouldRemind;
          } else {
            shouldVerifyPin = true;
          }

          if (options.forceVerify) {
            return true;
          }
          return shouldVerifyPin;
        };
        const shouldVerifyPin = await checkShouldVerifyPin();

        if (shouldVerifyPin) {
          // Check if the current route is still the Home tab before showing the dialog
          const isHomeTabFocused = () => {
            const state = rootNavigationRef.current?.getRootState();
            if (!state || state.routes.length > 1) {
              // There are modals or other routes on top
              return false;
            }
            const mainRoute = state.routes[0];
            const mainState = mainRoute?.state;
            // Check if the current tab is Home
            const currentTabRoute = mainState?.routes?.[mainState?.index ?? 0];
            return currentTabRoute?.name === ETabRoutes.Home;
          };

          if (!isHomeTabFocused()) {
            return;
          }

          const showPinReminderDialog = () => {
            isPinReminderDialogShowing = true;
            Dialog.show({
              showExitButton: false,
              disableDrag: true,
              dismissOnOverlayPress: false,
              icon: 'InputOutline',
              tone: 'success',
              title: intl.formatMessage({
                id: ETranslations.pin_verify_reminder_dialog_title,
              }),
              renderContent: (
                <YStack gap="$3">
                  <SizableText size="$bodyLg">
                    {intl.formatMessage(
                      {
                        id: ETranslations.pin_verify_reminder_dialog_desc,
                      },
                      {
                        em: (chunks: React.ReactNode) => (
                          <SizableText size="$bodyLgMedium">
                            {chunks}
                          </SizableText>
                        ),
                      },
                    )}
                  </SizableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.pin_reminder_email_tip,
                    })}
                  </SizableText>
                </YStack>
              ),
              showCancelButton: true,
              onCancelText: intl.formatMessage({
                id: ETranslations.global_later,
              }),
              onClose: () => {
                isPinReminderDialogShowing = false;
              },
              onCancel: async () => {
                isPinReminderDialogShowing = false;
                try {
                  await cancelVerifyPin(ownerId);
                } catch (error) {
                  // Continue to navigation if cancel fails
                  if (
                    errorUtils.isErrorByClassName({
                      error,
                      className: [
                        EOneKeyErrorClassNames.PasswordPromptDialogCancel,
                      ],
                    })
                  ) {
                    showPinReminderDialog();
                  }
                }
              },
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_continue,
              }),
              onConfirm: async ({ close }) => {
                // Close PIN reminder dialog first
                isPinReminderDialogShowing = false;
                await close();

                try {
                  // Verify password (returns immediately if cached, otherwise shows dialog)
                  await backgroundApiProxy.servicePassword.promptPasswordVerify();

                  // Password verified - show loading dialog
                  isPinReminderDialogShowing = true;
                  const loadingDialog = Dialog.loading({
                    title: intl.formatMessage({
                      id: ETranslations.global_preparing,
                    }),
                  });

                  try {
                    const shouldVerifyPin0 = await checkShouldVerifyPin();
                    if (!shouldVerifyPin0) {
                      Toast.success({
                        title: intl.formatMessage({
                          id: ETranslations.pin_verify_reminder_dialog_verified_toast,
                        }),
                      });
                      isPinReminderDialogShowing = false;
                      await loadingDialog.close();
                      return;
                    }

                    const isHealthy =
                      await backgroundApiProxy.serviceKeylessWallet.apiCheckAuthServerStatus();
                    if (!isHealthy) {
                      Toast.error({
                        title: intl.formatMessage({
                          id: ETranslations.auth_server_error_text,
                        }),
                      });
                      isPinReminderDialogShowing = false;
                      await loadingDialog.close();
                      return;
                    }

                    // Navigate first (includes async prep work), then close loading dialog
                    await goToOneKeyIDLoginPageForKeylessWallet({
                      mode: EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly,
                    });

                    isPinReminderDialogShowing = false;
                    await loadingDialog.close();
                  } catch (innerError) {
                    isPinReminderDialogShowing = false;
                    await loadingDialog.close();
                    errorToastUtils.toastIfError(innerError);
                  } finally {
                    await loadingDialog.close();
                  }
                } catch (error) {
                  // Password dialog cancelled - reshow original PIN reminder
                  if (
                    errorUtils.isErrorByClassName({
                      error,
                      className: [
                        EOneKeyErrorClassNames.PasswordPromptDialogCancel,
                      ],
                    })
                  ) {
                    showPinReminderDialog();
                  }
                }
              },
            });
          };

          showPinReminderDialog();
        }
      }
    },
    [
      cancelVerifyPin,
      devSettings.enabled,
      goToOneKeyIDLoginPageForKeylessWallet,
      intl,
      keylessLastCancelVerifyPinTime,
      keylessPinConfirmStatus?.remindTime,
      keylessPinConfirmStatus?.socialProvider,
      keylessPinConfirmStatus?.socialUserIdHash,
    ],
  );
  return { verifyKeylessPinChecking, cancelVerifyPin };
}

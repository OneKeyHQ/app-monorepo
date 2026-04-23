import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  SizableText,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  EFinalizeWalletSetupSteps,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type EOnboardingPagesV2,
  ERootRoutes,
  type IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { getKeylessOnboardingPin } from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useKeylessWebFlowAutoConnectDapp } from '../../../hooks/useWebDapp/useKeylessWebFlow';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import { withPromptPasswordVerify } from '../../../utils/passwordUtils';
import { OnboardingPage } from '../components/Layout';
import {
  useConnectDeviceError,
  useDeviceConnect,
} from '../hooks/useDeviceConnect';

import type { SearchDevice } from '@onekeyfe/hd-core';

const fixErrorString = (errorMessage: string) => {
  if (errorMessage.toLowerCase() === 'no wallet creation strategy') {
    return ETranslations.hardware_user_cancel_error;
  }
  return errorMessage;
};

function FinalizeWalletSetupPage({
  route,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.FinalizeWalletSetup
>) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();

  // EncryptingData is intentionally omitted — there is no corresponding real work.
  const stepTitles = useMemo<
    Partial<Record<EFinalizeWalletSetupSteps, string>>
  >(
    () => ({
      // TODO(i18n): replace with ETranslations.onboarding_finalize_connecting_device once Lokalise key is created
      [EFinalizeWalletSetupSteps.ConnectingDevice]: 'Connecting to device',
      [EFinalizeWalletSetupSteps.CreatingWallet]: intl.formatMessage({
        id: ETranslations.onboarding_finalize_creating_wallet,
      }),
      [EFinalizeWalletSetupSteps.GeneratingAccounts]: intl.formatMessage({
        id: ETranslations.onboarding_finalize_generating_accounts,
      }),
    }),
    [intl],
  );
  const [setupError, setSetupError] = useState<
    | {
        messageId: ETranslations;
      }
    | undefined
  >(undefined);

  const created = useRef(false);
  const mnemonic = route?.params?.mnemonic;
  const mnemonicType = route?.params?.mnemonicType;
  const keylessPackSetId = route?.params?.keylessPackSetId;
  const deviceData = route?.params?.deviceData;
  const isFirmwareVerified = route?.params?.isFirmwareVerified;
  const isWalletBackedUp = route?.params?.isWalletBackedUp;
  const isKeylessWallet = route?.params?.isKeylessWallet;
  const keylessDetailsInfo = route?.params?.keylessDetailsInfo;
  const shouldAutoResetKeylessPinAfterRestore =
    route?.params?.shouldAutoResetKeylessPinAfterRestore;

  // Hardware path starts with "Connecting to device" because connectDevice()
  // runs before the backend wallet creation pipeline emits any events.
  const initialStep = route?.params?.deviceData
    ? EFinalizeWalletSetupSteps.ConnectingDevice
    : EFinalizeWalletSetupSteps.CreatingWallet;

  const [currentStep, setCurrentStep] =
    useState<EFinalizeWalletSetupSteps>(initialStep);

  const stepQueue = useRef<EFinalizeWalletSetupSteps[]>([]);

  const closePageCalled = useRef(false);

  const closePage = useCallback(() => {
    closePageCalled.current = true;
    void backgroundApiProxy.serviceHardware.clearForceTransportType();
    navigation.navigate(ERootRoutes.Main, undefined, {
      pop: true,
    });
  }, [navigation]);

  const {
    setPendingKeylessAutoConnectWalletId,
    openKeylessAutoConnectDappModal,
  } = useKeylessWebFlowAutoConnectDapp();

  // Ready state waits for the user's Let's-go press instead of auto-closing.
  // The 600ms delay gives the page-dismiss animation time to finish before
  // the auto-connect dapp modal appears on top of the next (Main) screen.
  const handleLetsGo = useCallback(async () => {
    if (closePageCalled.current) return;
    closePage();
    await timerUtils.wait(600);
    void openKeylessAutoConnectDappModal();
  }, [closePage, openKeylessAutoConnectDappModal]);

  const processNextStep = useCallback(() => {
    while (stepQueue.current.length > 0) {
      const nextStep = stepQueue.current.shift();
      if (nextStep) {
        setCurrentStep(nextStep);
      }
    }
  }, []);

  const goNextStep = useCallback(
    (step: EFinalizeWalletSetupSteps) => {
      if (!stepQueue.current.includes(step)) {
        stepQueue.current.push(step);
      }
      processNextStep();
    },
    [processNextStep],
  );

  const actions = useAccountSelectorActions();

  const { connectDevice, createHWWallet } = useDeviceConnect();
  const createWallet = useCallback(async () => {
    try {
      let hdWalletCreatedResult:
        | {
            wallet: IDBWallet;
            indexedAccount: IDBIndexedAccount | undefined;
            isOverrideWallet: boolean | undefined;
          }
        | undefined;
      if (mnemonic && !created.current) {
        await withPromptPasswordVerify({
          run: async () => {
            if (mnemonicType === EMnemonicType.TON) {
              await actions.current.createTonImportedWallet({ mnemonic });
              return;
            }
            const shouldRunAutoReset =
              !!isKeylessWallet && !!shouldAutoResetKeylessPinAfterRestore;
            hdWalletCreatedResult = await actions.current.createHDWallet({
              mnemonic,
              isWalletBackedUp,
              isKeylessWallet,
              keylessDetailsInfo,
            });
            if (shouldRunAutoReset) {
              void (async () => {
                try {
                  if (!keylessDetailsInfo?.keylessOwnerId) {
                    return;
                  }
                  const refreshResult =
                    await backgroundApiProxy.serviceKeylessWallet.tryRefreshTokenFromStorage(
                      {
                        ownerId: keylessDetailsInfo?.keylessOwnerId,
                        forceRefresh: true,
                      },
                    );
                  if (
                    !refreshResult?.accessToken ||
                    !refreshResult?.refreshToken
                  ) {
                    return;
                  }
                  const [token, refreshToken, pin] = await Promise.all([
                    refreshResult.accessToken,
                    refreshResult.refreshToken,
                    getKeylessOnboardingPin(),
                  ]);
                  if (!token || !pin || !refreshToken) {
                    console.error(
                      'Skip keyless auto reset pin: missing onboarding token or pin.',
                    );
                    return;
                  }

                  await backgroundApiProxy.serviceKeylessWallet.autoResetKeylessWalletPinAfterRestoreForSameEmailAccount(
                    {
                      token,
                      refreshToken: refreshToken || undefined,
                      pin,
                    },
                  );
                } catch (autoResetError) {
                  console.error(
                    'autoResetKeylessWalletPinAfterRestoreForSameEmailAccount error:',
                    autoResetError,
                  );
                }
              })();
            }

            if (isKeylessWallet && keylessDetailsInfo) {
              defaultLogger.account.wallet.walletAdded({
                status: 'success',
                addMethod: 'CreateKeylessWallet',
                isSoftwareWalletOnlyUser: true,
                details: {
                  provider:
                    keylessDetailsInfo.keylessProvider ===
                    EOAuthSocialLoginProvider.Google
                      ? 'google'
                      : 'apple',
                },
              });

              if (
                platformEnv.isExtension &&
                accountUtils.isKeylessWallet({
                  walletId: hdWalletCreatedResult?.wallet.id,
                })
              ) {
                setPendingKeylessAutoConnectWalletId(
                  hdWalletCreatedResult?.wallet.id,
                );
              }
            }
          },
        });
        created.current = true;
      } else if (deviceData && isFirmwareVerified !== undefined) {
        goNextStep(EFinalizeWalletSetupSteps.ConnectingDevice);
        await connectDevice(deviceData.device as SearchDevice);
        await createHWWallet({
          device: deviceData.device as SearchDevice,
          isFirmwareVerified,
        });
      } else if (keylessPackSetId && !created.current) {
        created.current = true;
      }
    } catch (error) {
      console.error('createWallet error:', error);
      const hardwareError = error as {
        messageId: ETranslations;
        message: string;
      };
      setSetupError({
        messageId: fixErrorString(
          hardwareError
            ? hardwareError.messageId ||
                hardwareError.message ||
                ETranslations.global_unknown_error
            : ETranslations.global_unknown_error,
        ) as ETranslations,
      });
    }
  }, [
    mnemonic,
    deviceData,
    isFirmwareVerified,
    keylessPackSetId,
    mnemonicType,
    actions,
    isWalletBackedUp,
    isKeylessWallet,
    keylessDetailsInfo,
    shouldAutoResetKeylessPinAfterRestore,
    connectDevice,
    createHWWallet,
    setPendingKeylessAutoConnectWalletId,
    goNextStep,
  ]);

  useEffect(() => {
    void createWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fn = (
      event: IAppEventBusPayload[EAppEventBusNames.FinalizeWalletSetupStep],
    ) => {
      goNextStep(event.step);
    };

    appEventBus.on(EAppEventBusNames.FinalizeWalletSetupStep, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.FinalizeWalletSetupStep, fn);
    };
  }, [goNextStep]);

  useConnectDeviceError(
    useCallback((errorMessageId) => {
      setSetupError({
        messageId: errorMessageId,
      });
    }, []),
  );

  const retrySetup = useCallback(() => {
    setSetupError(undefined);
    setCurrentStep(initialStep);
    stepQueue.current = [];
    void createWallet();
  }, [createWallet, initialStep]);

  const isReady = currentStep === EFinalizeWalletSetupSteps.Ready;

  return (
    <OnboardingPage
      headerBack={false}
      showLanguageSelector={false}
      enterAnimation={false}
    >
      <YStack flex={1}>
        {setupError ? (
          <YStack
            gap="$4"
            alignSelf="center"
            w="100%"
            maxWidth="$96"
            flex={1}
            justifyContent="center"
          >
            <SizableText size="$heading2xl">
              {intl.formatMessage({
                id: ETranslations.failed_to_create_wallet,
              })}
            </SizableText>
            <SizableText size="$bodyLg">
              {intl.formatMessage({
                id: setupError.messageId,
                defaultMessage: setupError.messageId,
              })}
            </SizableText>
            <XStack gap="$2.5" mt="$4">
              <Button
                flex={1}
                variant="primary"
                size="large"
                onPress={retrySetup}
              >
                {intl.formatMessage({ id: ETranslations.global_retry })}
              </Button>
              <Button flex={1} size="large" onPress={closePage}>
                {intl.formatMessage({ id: ETranslations.global_exit })}
              </Button>
            </XStack>
          </YStack>
        ) : (
          <>
            <YStack flex={1} alignItems="center" justifyContent="center">
              <SizableText size="$heading2xl" textAlign="center">
                {isReady
                  ? // TODO(i18n): ETranslations.onboarding_finalize_wallet_ready
                    'Wallet ready'
                  : (stepTitles[currentStep] ?? '')}
              </SizableText>
            </YStack>
            <YStack
              pt="$4"
              alignItems="center"
              pb={safeAreaBottom > 0 ? safeAreaBottom + 12 : 0}
            >
              {isReady ? (
                <Button
                  variant="primary"
                  size="large"
                  onPress={handleLetsGo}
                  $md={{ w: '100%' }}
                  $gtMd={{ minWidth: 240 }}
                >
                  {/* TODO(i18n): ETranslations.onboarding_finalize_lets_go */}
                  Let&apos;s go
                </Button>
              ) : (
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.do_not_exit_app_during_setup,
                  })}
                </SizableText>
              )}
            </YStack>
          </>
        )}
      </YStack>
    </OnboardingPage>
  );
}

export function FinalizeWalletSetup({
  route,
  navigation,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.FinalizeWalletSetup
>) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <FinalizeWalletSetupPage route={route} navigation={navigation} />
    </AccountSelectorProviderMirror>
  );
}

export default FinalizeWalletSetup;

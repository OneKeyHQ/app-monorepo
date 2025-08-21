import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Heading,
  Icon,
  NavBackButton,
  NavCloseButton,
  Page,
  Spinner,
  Stack,
  usePreventRemove,
} from '@onekeyhq/components';
import { EMnemonicType } from '@onekeyhq/core/src/secret';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { OneKeyHardwareError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  EFinalizeWalletSetupSteps,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EOnboardingPages,
  IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { withPromptPasswordVerify } from '../../../utils/passwordUtils';

function FinalizeWalletSetupPage({
  route,
}: IPageScreenProps<
  IOnboardingParamList,
  EOnboardingPages.FinalizeWalletSetup
>) {
  const intl = useIntl();
  const [currentStep, setCurrentStep] = useState<EFinalizeWalletSetupSteps>(
    EFinalizeWalletSetupSteps.CreatingWallet,
  );
  const [showStep, setShowStep] = useState(false);
  const navigation = useAppNavigation();
  const mnemonic = route?.params?.mnemonic;
  const mnemonicType = route?.params?.mnemonicType;
  const isWalletBackedUp = route?.params?.isWalletBackedUp;
  const [onboardingError, setOnboardingError] = useState<
    IOneKeyError | undefined
  >(undefined);
  const closePageCalled = useRef(false);

  const {
    shouldBondReferralCode,
    getReferralCodeBondStatus,
    bindWalletInviteCode,
  } = useWalletBoundReferralCode({
    entry: 'tab',
    mnemonicType,
  });

  useEffect(() => {
    setOnboardingError(undefined);
  }, []);

  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });

  const actions = useAccountSelectorActions();
  const steps: Record<EFinalizeWalletSetupSteps, string> = {
    [EFinalizeWalletSetupSteps.CreatingWallet]: intl.formatMessage({
      id: ETranslations.onboarding_finalize_creating_wallet,
    }),
    [EFinalizeWalletSetupSteps.GeneratingAccounts]: intl.formatMessage({
      id: ETranslations.onboarding_finalize_generating_accounts,
    }),
    [EFinalizeWalletSetupSteps.EncryptingData]: intl.formatMessage({
      id: ETranslations.onboarding_finalize_encrypting_data,
    }),
    [EFinalizeWalletSetupSteps.Ready]: intl.formatMessage({
      id: ETranslations.onboarding_finalize_ready,
    }),
  };

  const created = useRef(false);

  const popPage = useCallback(
    async ({ delay }: { delay?: number } = {}) => {
      await timerUtils.wait(delay || 0);
      navigation.pop();
    },
    [navigation],
  );

  useEffect(() => {
    void (async () => {
      try {
        // **** hd wallet case
        if (mnemonic && !created.current) {
          await withPromptPasswordVerify({
            run: async () => {
              if (mnemonicType === EMnemonicType.TON) {
                // TODO check TON case
                // **** TON mnemonic case
                // Create TON imported account when mnemonicType is TON
                await actions.current.createTonImportedWallet({ mnemonic });
                setCurrentStep(EFinalizeWalletSetupSteps.Ready);
                return;
              }
              await actions.current.createHDWallet({
                mnemonic,
                isWalletBackedUp,
              });
            },
          });
          created.current = true;
        } else {
          // **** hardware wallet case
          // createHWWallet() is called before this page loaded
        }
        setShowStep(true);
      } catch (error) {
        void popPage({ delay: 300 });
        throw error;
      }
    })();
  }, [actions, intl, mnemonic, mnemonicType, popPage, isWalletBackedUp]);

  useEffect(() => {
    const fn = (
      event: IAppEventBusPayload[EAppEventBusNames.FinalizeWalletSetupStep],
    ) => {
      setCurrentStep(event.step);
    };

    appEventBus.on(EAppEventBusNames.FinalizeWalletSetupStep, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.FinalizeWalletSetupStep, fn);
    };
  }, []);

  const isFirstCreateWallet = useRef(false);
  const readIsFirstCreateWallet = async () => {
    const { isOnboardingDone } =
      await backgroundApiProxy.serviceOnboarding.isOnboardingDone();
    isFirstCreateWallet.current = !isOnboardingDone;
  };

  const closePage = useCallback(() => {
    closePageCalled.current = true;
    void backgroundApiProxy.serviceHardware.clearForceTransportType();
    navigation.navigate(ERootRoutes.Main, undefined, {
      pop: true,
    });
  }, [navigation]);

  useEffect(() => {
    const fn = (
      event: IAppEventBusPayload[EAppEventBusNames.FinalizeWalletSetupError],
    ) => {
      setOnboardingError(event.error);
      console.log('FinalizeWalletSetupError', event.error);
      setTimeout(
        () => {
          if (
            event.error instanceof OneKeyHardwareError ||
            event.error?.name === 'OneKeyHardwareError'
          ) {
            void popPage();
          }
        },
        platformEnv.isNative ? 450 : 200,
      );
    };

    appEventBus.on(EAppEventBusNames.FinalizeWalletSetupError, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.FinalizeWalletSetupError, fn);
    };
  }, [popPage]);

  const handleWalletSetupReadyInner = useCallback(async () => {
    const needBondReferralCode = await getReferralCodeBondStatus({
      walletId: wallet?.id,
      skipIfTimeout: true,
    });

    if (!needBondReferralCode) {
      setTimeout(() => {
        closePage();
        if (isFirstCreateWallet.current) {
          // void useBackupToggleDialog().maybeShow(true);
        }
      }, 1000);
    }
  }, [getReferralCodeBondStatus, closePage, wallet]);

  const handleWalletSetupReady = useThrottledCallback(
    handleWalletSetupReadyInner,
    500,
    { leading: true, trailing: false },
  );

  useEffect(() => {
    if (currentStep === EFinalizeWalletSetupSteps.CreatingWallet) {
      void readIsFirstCreateWallet();
    }
    if (!showStep) {
      return;
    }
    if (currentStep === EFinalizeWalletSetupSteps.Ready) {
      void handleWalletSetupReady();
    }
  }, [currentStep, navigation, showStep, handleWalletSetupReady]);

  const showCloseButton =
    currentStep === EFinalizeWalletSetupSteps.Ready || onboardingError;

  const renderHeaderLeft = useCallback(() => {
    if (shouldBondReferralCode) {
      return <NavCloseButton onPress={closePage} />;
    }
    return (
      <NavBackButton
        opacity={showCloseButton ? 1 : 0}
        onPress={showCloseButton ? () => void popPage() : undefined}
      />
    );
  }, [showCloseButton, shouldBondReferralCode, popPage, closePage]);

  usePreventRemove(!showCloseButton, () => null);

  return (
    <Page
      onClose={() => {
        if (
          currentStep === EFinalizeWalletSetupSteps.Ready &&
          !closePageCalled.current
        ) {
          closePage();
        }
      }}
    >
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.onboarding_finalize_wallet_setup,
        })}
        headerLeft={renderHeaderLeft}
      />
      <Page.Body p="$5" justifyContent="center" alignItems="center">
        <Stack
          w="$16"
          h="$16"
          justifyContent="center"
          alignItems="center"
          testID="finalize-wallet-setup"
        >
          <AnimatePresence exitBeforeEnter>
            {currentStep === EFinalizeWalletSetupSteps.Ready ? (
              <Stack
                key="CheckRadioSolid"
                animation="quick"
                enterStyle={
                  platformEnv.isNativeAndroid
                    ? undefined
                    : {
                        opacity: 0,
                        scale: 0,
                      }
                }
              >
                <Icon name="CheckRadioSolid" color="$iconSuccess" size="$16" />
              </Stack>
            ) : (
              <Spinner
                key="spinner"
                size="large"
                animation="quick"
                exitStyle={
                  platformEnv.isNativeAndroid
                    ? undefined
                    : {
                        opacity: 0,
                        scale: 0,
                      }
                }
              />
            )}
          </AnimatePresence>
        </Stack>
        <AnimatePresence exitBeforeEnter>
          <Stack
            key={currentStep}
            animation="quick"
            enterStyle={{
              opacity: 0,
              x: 12,
            }}
          >
            <Heading mt="$5" size="$headingMd">
              {steps[currentStep]}
            </Heading>
          </Stack>
        </AnimatePresence>
      </Page.Body>
      {onboardingError ? (
        <Page.Footer
          onCancel={() => {
            void popPage();
          }}
        />
      ) : null}
      {shouldBondReferralCode ? (
        <Page.Footer
          onConfirmText={intl.formatMessage({
            id: ETranslations.referral_onboard_bind_code,
          })}
          onConfirm={() => {
            closePage();
            bindWalletInviteCode({
              wallet,
            });
          }}
          onCancelText={intl.formatMessage({
            id: ETranslations.referral_onboard_bind_code_finish,
          })}
          onCancel={() => {
            closePage();
          }}
        />
      ) : null}
    </Page>
  );
}

export function FinalizeWalletSetup({
  route,
  navigation,
}: IPageScreenProps<
  IOnboardingParamList,
  EOnboardingPages.FinalizeWalletSetup
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

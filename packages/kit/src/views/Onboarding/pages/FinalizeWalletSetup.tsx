import { useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Heading,
  Icon,
  Page,
  Spinner,
  Stack,
} from '@onekeyhq/components';
import { EMnemonicType } from '@onekeyhq/core/src/secret';
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
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
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
  const [onboardingError, setOnboardingError] = useState<
    IOneKeyError | undefined
  >(undefined);

  useEffect(() => {
    setOnboardingError(undefined);
  }, []);

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

  useEffect(() => {
    void (async () => {
      try {
        // **** hd wallet case
        if (mnemonic && !created.current) {
          await withPromptPasswordVerify({
            run: async () => {
              if (mnemonicType === EMnemonicType.TON) {
                // **** TON mnemonic case
                // Create TON imported account when mnemonicType is TON
                await actions.current.createTonImportedWallet({ mnemonic });
                setCurrentStep(EFinalizeWalletSetupSteps.Ready);
                return;
              }

              await actions.current.createHDWallet({
                mnemonic,
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
        navigation.pop();
        throw error;
      }
    })();
  }, [actions, mnemonic, mnemonicType, navigation]);

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

  useEffect(() => {
    const fn = (
      event: IAppEventBusPayload[EAppEventBusNames.FinalizeWalletSetupError],
    ) => {
      setOnboardingError(event.error);
    };

    appEventBus.on(EAppEventBusNames.FinalizeWalletSetupError, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.FinalizeWalletSetupError, fn);
    };
  }, []);

  const isFirstCreateWallet = useRef(false);
  const readIsFirstCreateWallet = async () => {
    const { isOnboardingDone } =
      await backgroundApiProxy.serviceOnboarding.isOnboardingDone();
    isFirstCreateWallet.current = !isOnboardingDone;
  };
  useEffect(() => {
    if (currentStep === EFinalizeWalletSetupSteps.CreatingWallet) {
      void readIsFirstCreateWallet();
    }
    if (!showStep) {
      return;
    }
    if (currentStep === EFinalizeWalletSetupSteps.Ready) {
      setTimeout(() => {
        navigation.navigate(ERootRoutes.Main);
        if (isFirstCreateWallet.current) {
          // void useBackupToggleDialog().maybeShow(true);
        }
      }, 1000);
    }
  }, [currentStep, navigation, showStep]);

  return (
    <Page>
      <Page.Header
        disableClose
        title={intl.formatMessage({
          id: ETranslations.onboarding_finalize_wallet_setup,
        })}
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
            //
            navigation.pop();
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

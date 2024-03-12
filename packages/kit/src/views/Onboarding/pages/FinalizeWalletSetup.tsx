import { useEffect, useRef, useState } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Heading,
  Icon,
  Page,
  Spinner,
  Stack,
} from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  EFinalizeWalletSetupSteps,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EOnboardingPages,
  IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';

function FinalizeWalletSetupPage({
  route,
}: IPageScreenProps<
  IOnboardingParamList,
  EOnboardingPages.FinalizeWalletSetup
>) {
  const [currentStep, setCurrentStep] = useState<EFinalizeWalletSetupSteps>(
    EFinalizeWalletSetupSteps.CreatingWallet,
  );
  const [showStep, setShowStep] = useState(false);
  const navigation = useAppNavigation();
  const mnemonic = route?.params?.mnemonic;

  const actions = useAccountSelectorActions();
  const steps: Record<EFinalizeWalletSetupSteps, string> = {
    [EFinalizeWalletSetupSteps.CreatingWallet]: 'Creating your wallet',
    [EFinalizeWalletSetupSteps.GeneratingAccounts]: 'Generating your accounts',
    [EFinalizeWalletSetupSteps.EncryptingData]: 'Encrypting your data',
    [EFinalizeWalletSetupSteps.Ready]: 'Your wallet is now ready',
  };

  const created = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        if (mnemonic && !created.current) {
          await actions.current.createHDWallet({
            mnemonic,
          });
          created.current = true;
        } else {
          // createHWWallet is called before this page loaded
        }
        setShowStep(true);
      } catch (error) {
        navigation.pop();
        throw error;
      }
    })();
  }, [actions, mnemonic, navigation]);

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
    if (!showStep) {
      return;
    }
    if (currentStep === EFinalizeWalletSetupSteps.Ready) {
      setTimeout(() => {
        navigation.navigate(ERootRoutes.Main);
      }, 1000);
    }
  }, [currentStep, navigation, showStep]);

  return (
    <Page>
      <Page.Header title="Finalize Wallet Setup" />
      <Page.Body p="$5" justifyContent="center" alignItems="center">
        <Stack w="$16" h="$16" justifyContent="center" alignItems="center">
          <AnimatePresence exitBeforeEnter>
            {currentStep === EFinalizeWalletSetupSteps.Ready ? (
              <Stack
                key="CheckRadioSolid"
                animation="quick"
                enterStyle={{
                  opacity: 0,
                  scale: 0,
                }}
              >
                <Icon name="CheckRadioSolid" color="$iconSuccess" size="$16" />
              </Stack>
            ) : (
              <Spinner
                key="spinner"
                size="large"
                animation="quick"
                exitStyle={{
                  opacity: 0,
                  scale: 0,
                }}
              />
            )}
          </AnimatePresence>
        </Stack>
        <AnimatePresence exitBeforeEnter>
          <Stack key={currentStep}>
            <Heading
              mt="$5"
              size="$headingMd"
              animation="quick"
              enterStyle={{
                opacity: 0,
                x: 12,
              }}
            >
              {steps[currentStep]}
            </Heading>
          </Stack>
        </AnimatePresence>
      </Page.Body>
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

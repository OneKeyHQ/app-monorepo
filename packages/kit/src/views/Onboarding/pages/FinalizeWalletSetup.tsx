import { useEffect, useRef, useState } from 'react';

import { AnimatePresence } from 'tamagui';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Heading, Icon, Page, Spinner, Stack } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';

import type { EOnboardingPages, IOnboardingParamList } from '../router/type';

function FinalizeWalletSetupPage({
  route,
}: IPageScreenProps<
  IOnboardingParamList,
  EOnboardingPages.FinalizeWalletSetup
>) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showStep, setShowStep] = useState(false);
  const navigation = useAppNavigation();
  const mnemonic = route?.params?.mnemonic;

  const actions = useAccountSelectorActions();
  const steps = [
    'Creating your wallet',
    'Generating your accounts',
    'Encrypting your data',
    'Your wallet is now ready',
  ];

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
    if (!showStep) {
      return;
    }
    const interval = setInterval(() => {
      setCurrentStep((prevStep) => {
        if (prevStep < steps.length - 1) {
          return prevStep + 1;
        }
        clearInterval(interval);
        return prevStep;
      });
    }, 1000);

    if (currentStep === steps.length - 1) {
      setTimeout(() => {
        navigation.popStack();
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [currentStep, navigation, showStep, steps.length]);

  return (
    <Page>
      <Page.Header title="Finalize Wallet Setup" />
      <Page.Body p="$5" justifyContent="center" alignItems="center">
        <Stack w="$16" h="$16" justifyContent="center" alignItems="center">
          <AnimatePresence exitBeforeEnter>
            {currentStep === steps.length - 1 ? (
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
          {steps.map((item, index) => (
            <Stack key={item}>
              {currentStep === index && (
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
              )}
            </Stack>
          ))}
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

import { useEffect, useState } from 'react';

import { AnimatePresence } from 'tamagui';

import { Heading, Icon, Page, Spinner, Stack } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';

export function FinalizeWalletSetup() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigation = useAppNavigation();

  const steps = [
    'Creating your wallet',
    'Generating your accounts',
    'Encrypting your data',
    'Your wallet is now ready',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prevStep) => {
        if (prevStep < steps.length - 1) {
          return prevStep + 1;
        }
        clearInterval(interval);
        return prevStep;
      });
    }, 3000);

    if (currentStep === steps.length - 1) {
      setTimeout(() => {
        navigation.popStack();
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [currentStep, navigation, steps.length]);

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
            <>
              {currentStep === index && (
                <Heading
                  key={item}
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
            </>
          ))}
        </AnimatePresence>
      </Page.Body>
    </Page>
  );
}

import { useCallback, useState } from 'react';

import type { IImageProps } from '@onekeyhq/components';
import { Button, Image, Page, YStack } from '@onekeyhq/components';

import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { CheckItem } from '../components/CheckItem';
import { PageContainer } from '../components/PageContainer';

export default function CheckAndUpdate() {
  const themeVariant = useThemeVariant();
  const [steps, setSteps] = useState<
    {
      image: IImageProps['source'];
      title: string;
      description?: string;
      state?: 'running' | 'success';
    }[]
  >([
    {
      image:
        themeVariant === 'light'
          ? require('@onekeyhq/kit/assets/onboarding/genuine-check.png')
          : require('@onekeyhq/kit/assets/onboarding/genuine-check-dark.png'),
      title: 'Genuine check',
      description: 'Make sure your OneKey Pro is authentic',
    },
    {
      image:
        themeVariant === 'light'
          ? require('@onekeyhq/kit/assets/onboarding/firmware-check.png')
          : require('@onekeyhq/kit/assets/onboarding/firmware-check-dark.png'),
      title: 'Firmware check',
      description: 'See if your OneKey Pro has the latest software',
    },
  ]);

  const handleCheck = useCallback(() => {
    // Set first step to running
    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[0] = { ...newSteps[0], state: 'running' };
      return newSteps;
    });

    // Simulate first check completing after 2 seconds
    setTimeout(() => {
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[0] = { ...newSteps[0], state: 'success' };
        // Start second step
        newSteps[1] = { ...newSteps[1], state: 'running' };
        return newSteps;
      });

      // Simulate second check completing after another 2 seconds
      setTimeout(() => {
        setSteps((prev) => {
          const newSteps = [...prev];
          newSteps[1] = { ...newSteps[1], state: 'success' };
          return newSteps;
        });
      }, 2000);
    }, 2000);
  }, []);

  return (
    <Page>
      <Page.Header title="Check & Update" />
      <Page.Body>
        <PageContainer gap="$10">
          {steps.map((step, index) => (
            <CheckItem key={step.title} running={step.state === 'running'}>
              {index !== steps.length - 1 ? (
                <YStack
                  w={2}
                  borderWidth={0}
                  borderLeftWidth={2}
                  borderStyle="dashed"
                  borderColor="$neutral3"
                  position="absolute"
                  left={31}
                  top={64}
                  bottom={-40}
                />
              ) : null}
              <CheckItem.Image state={step.state}>
                <Image source={step.image} width={64} height={64} />
              </CheckItem.Image>
              <CheckItem.Content>
                <CheckItem.Title>{step.title}</CheckItem.Title>
                <CheckItem.Description>
                  {step.description}
                </CheckItem.Description>
              </CheckItem.Content>
            </CheckItem>
          ))}
          <Button variant="primary" size="large" onPress={handleCheck}>
            Check my OneKey Pro
          </Button>
        </PageContainer>
      </Page.Body>
    </Page>
  );
}

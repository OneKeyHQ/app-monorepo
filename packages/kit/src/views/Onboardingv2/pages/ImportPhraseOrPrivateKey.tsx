import { useState } from 'react';

import {
  Button,
  HeightTransition,
  Page,
  SegmentControl,
  SizableText,
  TextAreaInput,
  YStack,
} from '@onekeyhq/components';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';

export default function ImportPhraseOrPrivateKey() {
  const navigation = useAppNavigation();
  const [selected, setSelected] = useState<'phrase' | 'privateKey'>('phrase');

  const handleConfirm = () => {
    if (selected === 'phrase') {
      console.log('handlePhraseConfirm');
    } else {
      // Navigate to network selection page for private key import
      void navigation.push(EOnboardingPagesV2.SelectPrivateKeyNetwork, {
        privateKey: '',
      });
    }
  };

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Import Phrase or Private Key" />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent gap="$10">
            <SegmentControl
              value={selected}
              fullWidth
              options={[
                { label: 'Recovery phrase', value: 'phrase' },
                { label: 'Private Key', value: 'privateKey' },
              ]}
              onChange={(value) =>
                setSelected(value as 'phrase' | 'privateKey')
              }
            />
            <HeightTransition>
              {selected === 'phrase' ? (
                <>
                  <YStack
                    key="phrase"
                    animation="quick"
                    animateOnly={['opacity']}
                    enterStyle={{
                      opacity: 0,
                    }}
                  >
                    <SizableText>
                      Amet reprehenderit aute aute exercitation et consectetur
                      ut sit excepteur. Culpa eiusmod sunt ea proident eiusmod
                      dolore aliquip pariatur veniam minim incididunt fugiat do
                      ipsum commodo. Enim velit qui aliquip pariatur dolor Lorem
                      ipsum adipisicing voluptate ad excepteur.
                    </SizableText>
                  </YStack>
                </>
              ) : (
                <YStack
                  key="privateKey"
                  animation="quick"
                  animateOnly={['opacity']}
                  enterStyle={{
                    opacity: 0,
                  }}
                >
                  <TextAreaInput
                    size="large"
                    numberOfLines={5}
                    placeholder="Enter your private key"
                  />
                </YStack>
              )}
            </HeightTransition>
            <Button
              size="large"
              variant="primary"
              onPress={() => handleConfirm()}
            >
              Confirm
            </Button>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}

import { useState } from 'react';

import {
  Button,
  HeightTransition,
  Page,
  SegmentControl,
  TextAreaInput,
  YStack,
} from '@onekeyhq/components';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import type { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { PhaseInputArea } from '../components/PhaseInputArea';

export default function ImportPhraseOrPrivateKey() {
  const navigation = useAppNavigation();
  const [selected, setSelected] = useState<'phrase' | 'privateKey'>('phrase');

  const handleConfirm = ({
    mnemonic,
    mnemonicType,
  }: {
    mnemonic: string;
    mnemonicType: EMnemonicType;
  }) => {
    if (selected === 'phrase') {
      console.log('handlePhraseConfirm');
      navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
        mnemonic,
        mnemonicType,
      });
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
                <PhaseInputArea defaultPhrases={[]} onConfirm={handleConfirm} />
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
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}

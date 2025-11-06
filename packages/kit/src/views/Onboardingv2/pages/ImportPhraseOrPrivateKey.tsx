import type { RefObject } from 'react';
import { useRef, useState } from 'react';

import {
  Button,
  HeightTransition,
  Page,
  SegmentControl,
  TextAreaInput,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import type { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { PhaseInputArea } from '../components/PhaseInputArea';

import type { IPhaseInputAreaInstance } from '../components/PhaseInputArea';

export default function ImportPhraseOrPrivateKey() {
  const navigation = useAppNavigation();
  const [selected, setSelected] = useState<'phrase' | 'privateKey'>('phrase');
  const { gtMd } = useMedia();
  const phaseInputAreaRef = useRef<IPhaseInputAreaInstance | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (selected === 'phrase') {
      const timerId = setTimeout(() => {
        setIsConfirming(false);
      }, 500);
      setIsConfirming(true);
      if (phaseInputAreaRef.current) {
        try {
          const { mnemonic, mnemonicType } =
            await phaseInputAreaRef.current.submit();
          navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
            mnemonic,
            mnemonicType,
            isWalletBackedUp: true,
          });
        } catch (error) {
          console.error(error);
        } finally {
          setIsConfirming(false);
          clearTimeout(timerId);
        }
      }
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
          <OnboardingLayout.ConstrainedContent gap="$5">
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
                <PhaseInputArea
                  ref={phaseInputAreaRef as RefObject<IPhaseInputAreaInstance>}
                  defaultPhrases={[]}
                />
              ) : (
                <YStack
                  key="privateKey"
                  animation="quick"
                  animateOnly={['opacity']}
                  enterStyle={{
                    opacity: 0,
                  }}
                  gap="$5"
                >
                  <TextAreaInput
                    size="large"
                    numberOfLines={5}
                    $platform-native={{
                      minHeight: 160,
                    }}
                    placeholder="Enter your private key"
                  />
                </YStack>
              )}
            </HeightTransition>
            {gtMd ? (
              <Button size="large" variant="primary" onPress={handleConfirm}>
                Continue
              </Button>
            ) : null}
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
        {!gtMd ? (
          <OnboardingLayout.Footer>
            <Button
              size="large"
              variant="primary"
              onPress={handleConfirm}
              loading={isConfirming}
              w="100%"
            >
              Confirm
            </Button>
          </OnboardingLayout.Footer>
        ) : null}
      </OnboardingLayout>
    </Page>
  );
}

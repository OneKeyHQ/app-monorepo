import type { RefObject } from 'react';
import { useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  HeightTransition,
  Page,
  SegmentControl,
  TextAreaInput,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { fixInputImportSingleChain } from '../../Onboarding/pages/ImportWallet/ImportSingleChainBase';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { PhaseInputArea } from '../components/PhaseInputArea';

import type { IPhaseInputAreaInstance } from '../components/PhaseInputArea';

export default function ImportWatchedAccount() {
  const navigation = useAppNavigation();
  const [selected, setSelected] = useState<'phrase' | 'privateKey'>('phrase');
  const { gtMd } = useMedia();
  const phaseInputAreaRef = useRef<IPhaseInputAreaInstance | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const intl = useIntl();
  const [privateKey, setPrivateKey] = useState('');

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
      const input =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: fixInputImportSingleChain(privateKey || '') || '',
        });
      // Navigate to network selection page for private key import
      void navigation.push(EOnboardingPagesV2.SelectPrivateKeyNetwork, {
        input,
      });
    }
  };

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={intl.formatMessage({
            id: ETranslations.import_phrase_or_private_key,
          })}
        />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent gap="$5">
            <SegmentControl
              value={selected}
              fullWidth
              options={[
                {
                  label: intl.formatMessage({
                    id: ETranslations.global_recovery_phrase,
                  }),
                  value: 'phrase',
                },
                {
                  label: intl.formatMessage({
                    id: ETranslations.global_private_key,
                  }),
                  value: 'privateKey',
                },
              ]}
              onChange={(value) =>
                setSelected(value as 'phrase' | 'privateKey')
              }
            />
            <HeightTransition>
              {selected === 'phrase' ? (
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
                    allowPaste
                    allowClear
                    allowSecureTextEye
                    size="large"
                    numberOfLines={5}
                    value={privateKey}
                    onChangeText={setPrivateKey}
                    $platform-native={{
                      minHeight: 160,
                    }}
                    placeholder={intl.formatMessage({
                      id: ETranslations.form_enter_private_key_placeholder,
                    })}
                  />
                </YStack>
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
                    allowPaste
                    allowClear
                    allowSecureTextEye
                    size="large"
                    numberOfLines={5}
                    value={privateKey}
                    onChangeText={setPrivateKey}
                    $platform-native={{
                      minHeight: 160,
                    }}
                    placeholder={intl.formatMessage({
                      id: ETranslations.form_enter_private_key_placeholder,
                    })}
                  />
                </YStack>
              )}
            </HeightTransition>
            {gtMd ? (
              <Button size="large" variant="primary" onPress={handleConfirm}>
                {intl.formatMessage({ id: ETranslations.global_confirm })}
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
              {intl.formatMessage({ id: ETranslations.global_confirm })}
            </Button>
          </OnboardingLayout.Footer>
        ) : null}
      </OnboardingLayout>
    </Page>
  );
}

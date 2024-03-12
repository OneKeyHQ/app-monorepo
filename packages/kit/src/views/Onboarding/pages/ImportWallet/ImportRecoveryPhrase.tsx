import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { PhaseInputArea } from '../../components/PhaseInputArea';

export function ImportRecoveryPhrase() {
  const navigation = useAppNavigation();

  const handleConfirmPress = (mnemonic: string) => {
    navigation.push(EOnboardingPages.FinalizeWalletSetup, {
      mnemonic,
    });
  };

  return (
    <Page scrollEnabled>
      <Page.Header title="Import Recovery Phrase" />
      <PhaseInputArea
        defaultPhrases={[]}
        onConfirm={handleConfirmPress}
        tutorials={[
          {
            iconName: 'QuestionmarkOutline',
            title: 'What is a recovery phrase?',
            description:
              'A series of 12, 18, or 24 words to restore your wallet.',
          },
          {
            iconName: 'ShieldCheckDoneOutline',
            title: 'Is it safe to enter it into OneKey?',
            description:
              "Yes, it's stored locally and never shared without consent.",
          },
          {
            iconName: 'InputOutline',
            title: "Why can't I type full words?",
            description:
              'To prevent keylogger attacks. Use suggested words for security.',
          },
          {
            iconName: 'ClipboardOutline',
            title: "Why can't I paste directly?",
            description:
              "Pasting sensitive information is discouraged due to potential clipboard data breaches, which could risk asset loss. We'll enable pasting in specific, secure scenarios as identified.",
          },
        ]}
      />
    </Page>
  );
}

export default ImportRecoveryPhrase;

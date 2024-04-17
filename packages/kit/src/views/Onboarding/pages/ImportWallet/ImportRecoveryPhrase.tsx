import { useCallback, useMemo } from 'react';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { PhaseInputArea } from '../../components/PhaseInputArea';

export function ImportRecoveryPhrase() {
  const navigation = useAppNavigation();

  const handleConfirmPress = useCallback(
    (mnemonic: string) => {
      navigation.push(EOnboardingPages.FinalizeWalletSetup, {
        mnemonic,
      });
    },
    [navigation],
  );

  const renderPhaseInputArea = useMemo(
    () => (
      <PhaseInputArea
        defaultPhrases={[]}
        onConfirm={handleConfirmPress}
        tutorials={[
          {
            title: 'What is a recovery phrase?',
            description:
              'A series of 12, 18, or 24 words to restore your wallet.',
          },
          {
            title: 'Is it safe to enter it into OneKey?',
            description:
              "Yes, it's stored locally and never shared without consent.",
          },
          {
            title: "Why can't I type full words?",
            description:
              'To prevent keylogger attacks. Use suggested words for security.',
          },
          {
            title: "Why can't I paste directly?",
            description:
              'To reduce risk of asset loss, avoid pasting sensitive information.',
          },
        ]}
      />
    ),
    [handleConfirmPress],
  );
  return (
    <Page scrollEnabled>
      <Page.Header title="Import Recovery Phrase" />
      {renderPhaseInputArea}
    </Page>
  );
}

export default ImportRecoveryPhrase;

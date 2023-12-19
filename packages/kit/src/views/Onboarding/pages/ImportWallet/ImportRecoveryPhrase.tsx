import { Page } from '@onekeyhq/components';

import { PhaseInputArea } from '../../Components/PhaseInputArea';

const tutorials = [
  {
    title: 'What is a recovery phrase?',
    description:
      'It is a 12, 18 or 24-word phrase that can be used to restore your wallet.',
  },
  {
    title: 'Is it safe to enter it into OneKey?',
    description:
      'Yes. It will be stored locally and never leave your device without your explicit permission.',
  },
  {
    title: "Why can't I type full words?",
    description:
      'Full word typing is off to block keyloggers. Pick words from our suggestions to ensure your recovery phrase stays secure.',
  },
];
export function ImportRecoveryPhrase() {
  return (
    <Page scrollEnabled>
      <Page.Header title="Import Recovery Phrase" />
      <PhaseInputArea onConfirm={console.log} tutorials={tutorials} />
    </Page>
  );
}

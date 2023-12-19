import { Page } from '@onekeyhq/components';

import { PhaseInputArea } from '../../Components/PhaseInputArea';

export function ImportRecoveryPhrase() {
  return (
    <Page scrollEnabled>
      <Page.Header title="Import Recovery Phrase" />
      <PhaseInputArea onConfirm={console.log} />
    </Page>
  );
}

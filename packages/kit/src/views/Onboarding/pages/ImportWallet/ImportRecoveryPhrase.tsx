import { useCallback, useMemo } from 'react';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  ETrackEventNames,
  trackEvent,
} from '@onekeyhq/shared/src/modules3rdParty/mixpanel';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { PhaseInputArea } from '../../components/PhaseInputArea';
import {
  Tutorials,
  defaultTutorialsListItem,
} from '../../components/Tutorials';

export function ImportRecoveryPhrase() {
  const navigation = useAppNavigation();

  const handleConfirmPress = useCallback(
    (mnemonic: string) => {
      navigation.push(EOnboardingPages.FinalizeWalletSetup, {
        mnemonic,
      });
      trackEvent(ETrackEventNames.ImportWallet, {
        import_method: 'mnemonic',
      });
    },
    [navigation],
  );

  const renderPhaseInputArea = useMemo(
    () => (
      <PhaseInputArea
        defaultPhrases={[]}
        onConfirm={handleConfirmPress}
        FooterComponent={<Tutorials px="$5" list={defaultTutorialsListItem} />}
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

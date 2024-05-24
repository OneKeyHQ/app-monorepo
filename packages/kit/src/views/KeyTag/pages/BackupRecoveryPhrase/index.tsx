import { useCallback, useMemo } from 'react';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { PhaseInputArea } from '@onekeyhq/kit/src/views/Onboarding/components/PhaseInputArea';
import {
  Tutorials,
  defaultTutorialsListItem,
} from '@onekeyhq/kit/src/views/Onboarding/components/Tutorials';
import { EModalKeyTagRoutes } from '@onekeyhq/shared/src/routes';

export function ImportRecoveryPhrase() {
  const navigation = useAppNavigation();

  const handleConfirmPress = useCallback(
    (mnemonic: string) => {
      navigation.push(EModalKeyTagRoutes.BackupDotMap, {
        encodedText: mnemonic,
        title: '',
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

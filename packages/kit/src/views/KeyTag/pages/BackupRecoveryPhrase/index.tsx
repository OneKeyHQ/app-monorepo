import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { PhaseInputArea } from '@onekeyhq/kit/src/views/Onboarding/components/PhaseInputArea';
import { Tutorials } from '@onekeyhq/kit/src/views/Onboarding/components/Tutorials';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalKeyTagRoutes } from '@onekeyhq/shared/src/routes';

export function ImportRecoveryPhrase() {
  const intl = useIntl();
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
        FooterComponent={
          <Tutorials
            px="$5"
            list={[
              {
                title: intl.formatMessage({
                  id: ETranslations.faq_recovery_phrase,
                }),
                description: intl.formatMessage({
                  id: ETranslations.faq_recovery_phrase_explaination,
                }),
              },
              {
                title: intl.formatMessage({
                  id: ETranslations.faq_recovery_phrase_safe_store,
                }),
                description: intl.formatMessage({
                  id: ETranslations.faq_recovery_phrase_safe_store_desc,
                }),
              },
            ]}
          />
        }
      />
    ),
    [handleConfirmPress, intl],
  );
  return (
    <Page scrollEnabled>
      <Page.Header title="Import Recovery Phrase" />
      {renderPhaseInputArea}
    </Page>
  );
}

export default ImportRecoveryPhrase;

import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { PhaseInputArea } from '../../components/PhaseInputArea';
import { Tutorials } from '../../components/Tutorials';

export function ImportRecoveryPhrase() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const handleConfirmPress = useCallback(
    (mnemonic: string) => {
      navigation.push(EOnboardingPages.FinalizeWalletSetup, {
        mnemonic,
      });
      defaultLogger.account.wallet.importWallet({ importMethod: 'mnemonic' });
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
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_import_recovery_phrase,
        })}
      />
      {renderPhaseInputArea}
    </Page>
  );
}

export default ImportRecoveryPhrase;

import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { importedAccountExcludeNetworkIds } from '@onekeyhq/kit/src/components/ChainSelectorInput/excludeNetworkIds';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IValidateGeneralInputParams } from '@onekeyhq/kit-bg/src/vaults/types';
import { WALLET_TYPE_IMPORTED } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Tutorials } from '../../components';

import {
  ImportSingleChainBase,
  fixInputImportSingleChain,
} from './ImportSingleChainBase';

function ImportPrivateKey() {
  const intl = useIntl();
  const validationParams = useMemo<IValidateGeneralInputParams>(
    () => ({
      input: '',
      validateXprvt: true,
      validatePrivateKey: true,
    }),
    [],
  );

  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();

  return (
    <ImportSingleChainBase
      title={intl.formatMessage({
        id: ETranslations.global_import_private_key,
      })}
      inputLabel={intl.formatMessage({ id: ETranslations.global_private_key })}
      inputPlaceholder={intl.formatMessage({
        id: ETranslations.form_enter_private_key_placeholder,
      })}
      inputIsSecure
      inputTestID="private-key"
      invalidMessage={intl.formatMessage({
        id: ETranslations.form_private_key_error_invalid,
      })}
      validationParams={validationParams}
      onConfirm={async (form) => {
        const values = form.getValues();
        if (!values.input || !values.networkId) {
          return;
        }
        console.log('add imported account', values);
        const input =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: fixInputImportSingleChain(values.input),
          });
        const r = await backgroundApiProxy.serviceAccount.addImportedAccount({
          input,
          deriveType: values.deriveType,
          networkId: values.networkId,
        });
        console.log(r, values);
        // global.success

        const accountId = r?.accounts?.[0]?.id;
        if (accountId) {
          Toast.success({
            title: intl.formatMessage({ id: ETranslations.global_success }),
          });
        }
        void actions.current.updateSelectedAccountForSingletonAccount({
          num: 0,
          networkId: values.networkId,
          walletId: WALLET_TYPE_IMPORTED,
          othersWalletAccountId: accountId,
        });
        navigation.popStack();
      }}
      excludedNetworkIds={importedAccountExcludeNetworkIds}
    >
      <Tutorials
        list={[
          {
            title: intl.formatMessage({ id: ETranslations.faq_private_key }),
            description: intl.formatMessage({
              id: ETranslations.faq_private_key_desc,
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
    </ImportSingleChainBase>
  );
}

function ImportPrivateKeyPage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <ImportPrivateKey />
    </AccountSelectorProviderMirror>
  );
}

export default ImportPrivateKeyPage;

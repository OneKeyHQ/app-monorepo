import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IValidateGeneralInputParams } from '@onekeyhq/kit-bg/src/vaults/types';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Tutorials } from '../../components';

import {
  ImportSingleChainBase,
  fixInputImportSingleChain,
} from './ImportSingleChainBase';

function ImportAddress() {
  const intl = useIntl();
  const validationParams = useMemo<IValidateGeneralInputParams>(
    () => ({
      input: '',
      validateAddress: true,
      validateXpub: true,
    }),
    [],
  );

  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();

  return (
    <ImportSingleChainBase
      title={intl.formatMessage({ id: ETranslations.global_import_address })}
      inputLabel={intl.formatMessage({
        id: ETranslations.global_address,
      })}
      inputPlaceholder={intl.formatMessage({
        id: ETranslations.form_address_placeholder,
      })}
      inputTestID="address"
      invalidMessage={intl.formatMessage({
        id: ETranslations.form_address_error_invalid,
      })}
      validationParams={validationParams}
      onConfirm={async (form) => {
        const values = form.getValues();
        if (!values.input || !values.networkId) {
          return;
        }
        const r = await backgroundApiProxy.serviceAccount.addWatchingAccount({
          input: fixInputImportSingleChain(values.input),
          networkId: values.networkId,
          deriveType: values.deriveType,
        });
        console.log(r, values);

        void actions.current.updateSelectedAccountForSingletonAccount({
          num: 0,
          networkId: values.networkId,
          walletId: WALLET_TYPE_WATCHING,
          othersWalletAccountId: r.accounts[0].id,
        });
        navigation.popStack();
      }}
    >
      <Tutorials
        list={[
          {
            title: intl.formatMessage({
              id: ETranslations.faq_watched_account,
            }),
            description: intl.formatMessage({
              id: ETranslations.faq_watched_account_desc,
            }),
          },
        ]}
      />
    </ImportSingleChainBase>
  );
}

function ImportAddressPage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <ImportAddress />
    </AccountSelectorProviderMirror>
  );
}

export default ImportAddressPage;

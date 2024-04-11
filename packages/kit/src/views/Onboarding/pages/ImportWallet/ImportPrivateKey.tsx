import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IValidateGeneralInputParams } from '@onekeyhq/kit-bg/src/vaults/types';
import { WALLET_TYPE_IMPORTED } from '@onekeyhq/shared/src/consts/dbConsts';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Tutorials } from '../../components';

import {
  ImportSingleChainBase,
  fixInputImportSingleChain,
} from './ImportSingleChainBase';

function ImportPrivateKey() {
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
      title="Import Private Key"
      inputLabel="Private Key"
      inputPlaceholder="Enter your private key"
      inputIsSecure
      inputTestID="private-key"
      invalidMessage="Invalid private key"
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

        void actions.current.updateSelectedAccount({
          num: 0,
          builder: (v) => ({
            ...v,
            networkId: values.networkId,
            focusedWallet: WALLET_TYPE_IMPORTED,
            walletId: WALLET_TYPE_IMPORTED,
            othersWalletAccountId: r.accounts[0].id,
            indexedAccountId: undefined,
          }),
        });
        navigation.popStack();
      }}
    >
      <Tutorials
        list={[
          {
            title: 'What is a private key?',
            description:
              'A combination of letters and numbers that is utilized to manage your assets.',
          },
          {
            title: 'Is it safe to enter it into OneKey?',
            description:
              'Yes. It will be stored locally and never leave your device without your explicit permission.',
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

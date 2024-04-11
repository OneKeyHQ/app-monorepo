import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IValidateGeneralInputParams } from '@onekeyhq/kit-bg/src/vaults/types';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Tutorials } from '../../components';

import {
  ImportSingleChainBase,
  fixInputImportSingleChain,
} from './ImportSingleChainBase';

function ImportAddress() {
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
      title="Add to Watchlist"
      inputLabel="Address"
      inputPlaceholder="Address or domain name"
      inputTestID="address"
      invalidMessage="Invalid address, domain or xpub"
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

        void actions.current.updateSelectedAccount({
          num: 0,
          builder: (v) => ({
            ...v,
            networkId: values.networkId,
            focusedWallet: WALLET_TYPE_WATCHING,
            walletId: WALLET_TYPE_WATCHING,
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
            title: 'What is a watch-only account?',
            description:
              "Watch-only account in OneKey allows monitoring of a specific address but cannot send or receive funds. It's useful for tracking transactions or monitoring holdings.",
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

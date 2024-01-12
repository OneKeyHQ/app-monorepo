import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../../components/AccountSelector';
import { type IAccountProps } from '../../router/types';

import { WalletDetails } from './WalletDetails';
import { WalletList } from './WalletList';

export function AccountSelectorStack({ num }: { num: number }) {
  const handleAccountPress = useCallback((accountId: IAccountProps['id']) => {
    console.log('handleAccountPress', accountId);
  }, []);

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header headerShown={false} />
      <Page.Body flexDirection="row">
        <WalletList num={num} />
        <WalletDetails num={num} onAccountPress={handleAccountPress} />
      </Page.Body>
    </Page>
  );
}

export default function AccountSelectorStackPage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home, // TODO read sceneName from router or jotai
      }}
    >
      <AccountSelectorStack
        // TODO read num from router or jotai
        num={0}
      />
    </AccountSelectorProviderMirror>
  );
}

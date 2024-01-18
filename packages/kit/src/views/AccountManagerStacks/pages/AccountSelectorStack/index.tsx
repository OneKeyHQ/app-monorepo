import { useCallback } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';

import { WalletDetails } from './WalletDetails';
import { WalletList } from './WalletList';

import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
  IAccountProps,
} from '../../router/types';

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

export default function AccountSelectorStackPage({
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.AccountSelectorStack
>) {
  const { num, sceneName, sceneUrl } = route.params;
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName,
        sceneUrl,
      }}
      enabledNum={[num]}
    >
      <AccountSelectorStack num={num} />
    </AccountSelectorProviderMirror>
  );
}

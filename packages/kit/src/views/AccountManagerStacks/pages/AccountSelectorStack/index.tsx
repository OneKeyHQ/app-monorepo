import type { IPageScreenProps } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';

import { WalletDetails } from './WalletDetails';
import { WalletList } from './WalletList';

export function AccountSelectorStack({ num }: { num: number }) {
  return (
    <Page safeAreaEnabled={false}>
      <Page.Header headerShown={false} />
      <Page.Body flexDirection="row">
        <WalletList num={num} />
        <WalletDetails num={num} />
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
      enabledNum={[num]}
      config={{
        sceneName,
        sceneUrl,
      }}
    >
      <AccountSelectorStack num={num} />
    </AccountSelectorProviderMirror>
  );
}

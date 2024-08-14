import type { IPageScreenProps } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';

import { WalletDetails } from './WalletDetails';
import {
  AccountSelectorWalletListSideBar,
  AccountSelectorWalletListSideBarPerfTest,
} from './WalletList';

export function AccountSelectorStack({ num }: { num: number }) {
  return (
    <Page safeAreaEnabled={false}>
      <Page.Header headerShown={false} />
      <Page.Body flexDirection="row">
        {/* <AccountSelectorWalletListSideBarPerfTest num={num} /> */}
        <AccountSelectorWalletListSideBar num={num} />

        {/* <WalletDetailsPerfTest num={num} /> */}
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

  defaultLogger.accountSelector.perf.renderAccountSelectorModal({
    num,
    sceneName,
    sceneUrl,
  });

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

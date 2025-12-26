import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';

import { WalletDetails } from './WalletDetails';
import { AccountSelectorWalletListSideBar } from './WalletList';

export function AccountSelectorStack({
  num,
  hideNonBackedUpWallet,
}: {
  num: number;
  hideNonBackedUpWallet?: boolean;
}) {
  return (
    <Page lazyLoad safeAreaEnabled={false}>
      <Page.Header headerShown={false} />
      <Page.Body>
        <XStack flex={1}>
          {/* <AccountSelectorWalletListSideBarPerfTest num={num} /> */}
          {platformEnv.isWebDappMode ? null : (
            <AccountSelectorWalletListSideBar
              num={num}
              hideNonBackedUpWallet={hideNonBackedUpWallet}
            />
          )}

          {/* <WalletDetailsPerfTest num={num} /> */}
          <WalletDetails num={num} />
        </XStack>
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
  const {
    num,
    sceneName,
    sceneUrl,
    hideNonBackedUpWallet,
    linkNetworkId,
    linkNetworkDeriveType,
    linkNetwork,
  } = route.params;

  defaultLogger.accountSelector.perf.renderAccountSelectorModal({
    num,
    sceneName,
    sceneUrl,
    linkNetworkId,
    linkNetworkDeriveType,
    linkNetwork,
  });

  return (
    <AccountSelectorProviderMirror
      enabledNum={[num]}
      config={{
        sceneName,
        sceneUrl,
      }}
    >
      <AccountSelectorStack
        num={num}
        hideNonBackedUpWallet={hideNonBackedUpWallet}
      />
    </AccountSelectorProviderMirror>
  );
}

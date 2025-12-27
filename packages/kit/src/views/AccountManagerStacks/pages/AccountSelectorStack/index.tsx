import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, XStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useSelectedAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';

import { useWebDappWalletSelector } from './useWebDappWalletSelector';
import { WalletDetails } from './WalletDetails';
import { AccountSelectorWalletListSideBar } from './WalletList';

export function AccountSelectorStack({
  num,
  hideNonBackedUpWallet,
}: {
  num: number;
  hideNonBackedUpWallet?: boolean;
}) {
  const { selectedAccount } = useSelectedAccount({ num });
  const { shouldHideWalletList } = useWebDappWalletSelector({
    num,
    focusedWallet: selectedAccount.focusedWallet,
  });

  return (
    <Page lazyLoad safeAreaEnabled={false}>
      <Page.Header headerShown={false} />
      <Page.Body>
        <XStack flex={1}>
          {/* <AccountSelectorWalletListSideBarPerfTest num={num} /> */}
          {shouldHideWalletList ? null : (
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

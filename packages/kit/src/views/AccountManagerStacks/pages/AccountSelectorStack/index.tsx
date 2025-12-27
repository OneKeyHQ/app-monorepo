import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
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
  // Check if user has hardware wallet (only in WebDapp mode)
  const { result: hasHardwareWallet } = usePromiseResult(async () => {
    if (!platformEnv.isWebDappMode) {
      return false;
    }
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
      nestedHiddenWallets: false,
    });
    return wallets.some((w) => w.type === 'hw');
  }, []);

  // Hide wallet list only in WebDapp mode AND when confirmed no hardware wallet
  // Use `=== false` to avoid hiding during loading state
  const shouldHideWalletList =
    platformEnv.isWebDappMode && hasHardwareWallet === false;

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

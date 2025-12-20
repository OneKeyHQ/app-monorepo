import { useEffect, useState } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';

import { WalletDetails } from './WalletDetails';
import { AccountSelectorWalletListSideBar } from './WalletList';

const useSafeAreaInsetsTop = platformEnv.isNativeAndroid
  ? () => {
      const { top } = useSafeAreaInsets();
      return top;
    }
  : () => {
      return undefined;
    };

export function AccountSelectorStack({
  num,
  hideNonBackedUpWallet,
}: {
  num: number;
  hideNonBackedUpWallet?: boolean;
}) {
  const top = useSafeAreaInsetsTop();
  return (
    <Page lazyLoad safeAreaEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <XStack flex={1} top={top}>
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

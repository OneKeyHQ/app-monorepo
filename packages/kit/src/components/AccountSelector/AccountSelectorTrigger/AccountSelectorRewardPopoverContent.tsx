import { useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Spinner, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorSceneInfo,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import { WalletDetails } from '@onekeyhq/kit/src/views/AccountManagerStacks/pages/AccountSelectorStack/WalletDetails';
import { AccountSelectorWalletListSideBar } from '@onekeyhq/kit/src/views/AccountManagerStacks/pages/AccountSelectorStack/WalletList';
import { AccountSelectorRouteContext } from '@onekeyhq/kit/src/views/AccountManagerStacks/router/useAccountSelectorRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes';

export default function AccountSelectorRewardPopoverContent({
  num,
  linkNetworkId,
  closePopover,
}: {
  num: number;
  linkNetworkId?: string;
  closePopover: () => void;
}) {
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  const { activeAccount } = useActiveAccount({ num });
  const initialWalletId = useRef(activeAccount.wallet?.id);
  const [walletListOpen, setWalletListOpen] = useState(false);
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      const linkNetworkDeriveType = linkNetworkId
        ? await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: linkNetworkId,
          })
        : undefined;
      if (initialWalletId.current) {
        await actions.current.updateSelectedAccountFocusedWallet({
          num,
          focusedWallet: initialWalletId.current,
          reason: 'openRewardAccountPopover',
        });
      }
      return { linkNetworkDeriveType };
    },
    [actions, linkNetworkId, num],
    {
      checkIsFocused: false,
      watchLoading: true,
      undefinedResultIfError: true,
    },
  );
  const route = useMemo(
    () => ({
      key: 'reward-account-popover',
      name: EAccountManagerStacksRoutes.AccountSelectorStack as const,
      params: {
        num,
        sceneName,
        sceneUrl,
        linkNetwork: Boolean(linkNetworkId),
        linkNetworkId,
        linkNetworkDeriveType: result?.linkNetworkDeriveType,
        editable: false,
      },
    }),
    [linkNetworkId, num, result?.linkNetworkDeriveType, sceneName, sceneUrl],
  );

  if (!result) {
    return (
      <YStack height={200} alignItems="center" justifyContent="center">
        {isLoading !== false ? (
          <Spinner />
        ) : (
          <Button
            testID="reward-account-popover-retry"
            onPress={() => void run()}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        )}
      </YStack>
    );
  }

  return (
    <AccountSelectorRouteContext.Provider value={route}>
      <YStack height={360} maxHeight="100%" minHeight={0}>
        <AccountSelectorWalletListSideBar
          num={num}
          presentation="popover"
          hideWatchingWallet
          walletListOpen={walletListOpen}
          onWalletListOpenChange={setWalletListOpen}
        />
        {walletListOpen ? null : (
          <WalletDetails
            num={num}
            compact
            showHeader={false}
            showSearch={false}
            onAccountSelected={closePopover}
          />
        )}
      </YStack>
    </AccountSelectorRouteContext.Provider>
  );
}

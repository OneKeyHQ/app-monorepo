import { useCallback, useEffect, useState } from 'react';

import { throttle } from 'lodash';

import { ListItem, SizableText, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IConnectionAccountInfo,
  IConnectionItem,
  IConnectionProviderNames,
} from '@onekeyhq/shared/types/dappConnection';

type IAccountInfo = IConnectionAccountInfo & { address: string };
function ConnectionAccountListenerEffects({
  num,
  scope,
  handleAccountChanged,
}: {
  num: number;
  scope: IConnectionProviderNames;
  handleAccountChanged: (
    activeAccount: IAccountSelectorActiveAccountInfo,
    scope: IConnectionProviderNames,
  ) => void;
}) {
  const { activeAccount } = useActiveAccount({ num });
  const throttledHandleAccountChanged = throttle(handleAccountChanged, 1000, {
    leading: true,
    trailing: false,
  });
  useEffect(() => {
    console.log(
      'ConnectionAccountListenerEffects, ActiveAccount Changed: ',
      activeAccount,
    );
    throttledHandleAccountChanged(activeAccount, scope);

    return () => {
      throttledHandleAccountChanged.cancel();
    };
  }, [activeAccount, throttledHandleAccountChanged, scope]);

  return null;
}

function ConnectionListItem({
  item,
  handleAccountInfoChanged,
}: {
  item: IConnectionItem;
  handleAccountInfoChanged: ({
    item,
    selectedAccount,
    scope,
  }: {
    item: IConnectionItem;
    selectedAccount: IAccountSelectorActiveAccountInfo;
    scope: IConnectionProviderNames;
  }) => void;
}) {
  const [selectedAccount, setSelectedAccount] =
    useState<IAccountSelectorActiveAccountInfo | null>(null);
  const [accountInfos, setAccountInfos] = useState<IAccountInfo[]>([]);
  useEffect(() => {
    async function fetchAccountInfos() {
      const promises = Object.values(item.connectionMap).map(async (value) => {
        try {
          const accountDetails =
            await backgroundApiProxy.serviceAccount.getAccount({
              accountId: value.accountId,
              networkId: value.networkId,
            });

          return {
            ...value,
            address: accountDetails.address,
          };
        } catch (error) {
          console.error(error);
          return null;
        }
      });

      void Promise.all(promises).then((ret) => {
        const validAccountInfos = ret.filter((info) => info !== null);
        setAccountInfos(validAccountInfos as IAccountInfo[]);
      });
    }

    void fetchAccountInfos();
  }, [item.connectionMap]);

  const handleAccountChanged = useCallback(
    (
      activeAccount: IAccountSelectorActiveAccountInfo,
      scope: IConnectionProviderNames,
    ) => {
      setSelectedAccount(activeAccount);
      if (!activeAccount.account?.address) {
        return;
      }
      handleAccountInfoChanged({ item, selectedAccount: activeAccount, scope });
    },
    [handleAccountInfoChanged, item],
  );

  return (
    <ListItem
      avatarProps={{
        src: item.imageURL,
      }}
    >
      <YStack>
        <SizableText key={item.origin}>
          {new URL(item.origin).hostname}
        </SizableText>
        {accountInfos.map((info) => (
          <XStack width="100%">
            <SizableText key={info.type} maxWidth="70%">
              {selectedAccount?.account?.address ?? '无地址'}
            </SizableText>
            <YStack space="$2">
              <AccountSelectorProviderMirror
                config={{
                  sceneName: EAccountSelectorSceneName.discover,
                  sceneUrl: item.origin,
                }}
                enabledNum={[0]}
              >
                <AccountSelectorTriggerHome
                  sceneName={EAccountSelectorSceneName.discover}
                  sceneUrl={item.origin}
                  num={0}
                />
                <NetworkSelectorTriggerHome
                  sceneName={EAccountSelectorSceneName.discover}
                  sceneUrl={item.origin}
                  num={0}
                />
                <ConnectionAccountListenerEffects
                  num={0}
                  scope={info.type}
                  handleAccountChanged={handleAccountChanged}
                />
              </AccountSelectorProviderMirror>
            </YStack>
          </XStack>
        ))}
      </YStack>
    </ListItem>
  );
}

export default ConnectionListItem;

import { useCallback, useEffect, useState } from 'react';

import { throttle } from 'lodash';

import {
  IconButton,
  ListItem,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
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
} from '@onekeyhq/shared/types/dappConnection';

function ConnectionAccountListenerEffects({
  num,
  handleAccountChanged,
}: {
  num: number;
  handleAccountChanged: (
    activeAccount: IAccountSelectorActiveAccountInfo,
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
    // TODO:
    throttledHandleAccountChanged(activeAccount);

    return () => {
      throttledHandleAccountChanged.cancel();
    };
  }, [activeAccount, throttledHandleAccountChanged]);

  return null;
}

function ConnectionListItem({
  item,
  handleAccountInfoChanged,
  handleDisconnect,
}: {
  item: IConnectionItem;
  handleAccountInfoChanged: ({
    origin,
    accountSelectorNum,
    prevAccountInfo,
    selectedAccount,
  }: {
    origin: string;
    accountSelectorNum: number;
    prevAccountInfo: IConnectionAccountInfo;
    selectedAccount: IAccountSelectorActiveAccountInfo;
  }) => void;
  handleDisconnect: ({
    origin,
    networkImpl,
    accountSelectorNum,
  }: {
    origin: string;
    networkImpl: string;
    accountSelectorNum: number;
  }) => Promise<void>;
}) {
  // const [selectedAccount, setSelectedAccount] =
  //   useState<IAccountSelectorActiveAccountInfo | null>(null);
  // const [accountInfos, setAccountInfos] = useState<IAccountInfo[]>([]);
  // useEffect(() => {
  //   async function fetchAccountInfos() {
  //     const promises = Object.values(item.connectionMap).map(async (value) => {
  //       try {
  //         const accountDetails =
  //           await backgroundApiProxy.serviceAccount.getAccount({
  //             accountId: value.accountId,
  //             networkId: value.networkId,
  //           });

  //         return {
  //           ...value,
  //           address: accountDetails.address,
  //         };
  //       } catch (error) {
  //         console.error(error);
  //         return null;
  //       }
  //     });

  //     void Promise.all(promises).then((ret) => {
  //       const validAccountInfos = ret.filter((info) => info !== null);
  //       setAccountInfos(validAccountInfos as IAccountInfo[]);
  //     });
  //   }

  //   void fetchAccountInfos();
  // }, [item.connectionMap]);

  const handleAccountChanged = useCallback(
    ({
      origin,
      accountSelectorNum,
      prevAccountInfo,
      activeAccount,
    }: {
      origin: string;
      accountSelectorNum: number;
      prevAccountInfo: IConnectionAccountInfo;
      activeAccount: IAccountSelectorActiveAccountInfo;
    }) => {
      // setSelectedAccount(activeAccount);
      if (!activeAccount?.account?.address) {
        return;
      }
      handleAccountInfoChanged({
        origin,
        accountSelectorNum,
        prevAccountInfo,
        selectedAccount: activeAccount,
      });
    },
    [handleAccountInfoChanged],
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
        {Object.entries(item.connectionMap).map(([num, accountInfo]) => (
          <XStack width="100%" key={`${num}-${accountInfo.networkImpl}`}>
            <SizableText maxWidth="70%">
              {accountInfo.address ?? '无地址'}
            </SizableText>
            <YStack space="$2">
              <AccountSelectorProviderMirror
                config={{
                  sceneName: EAccountSelectorSceneName.discover,
                  sceneUrl: item.origin,
                }}
                enabledNum={[Number(num)]}
              >
                <AccountSelectorTriggerHome
                  sceneName={EAccountSelectorSceneName.discover}
                  sceneUrl={item.origin}
                  num={Number(num)}
                />
                <NetworkSelectorTriggerHome
                  sceneName={EAccountSelectorSceneName.discover}
                  sceneUrl={item.origin}
                  num={Number(num)}
                />
                <ConnectionAccountListenerEffects
                  num={Number(num)}
                  handleAccountChanged={(activeAccount) =>
                    handleAccountChanged({
                      origin: item.origin,
                      accountSelectorNum: Number(num),
                      prevAccountInfo: accountInfo,
                      activeAccount,
                    })
                  }
                />
              </AccountSelectorProviderMirror>
            </YStack>
            <IconButton
              icon="CrossedSmallOutline"
              color="$iconActive"
              onPress={() =>
                handleDisconnect({
                  origin: item.origin,
                  networkImpl: accountInfo.networkImpl,
                  accountSelectorNum: Number(num),
                })
              }
            />
          </XStack>
        ))}
      </YStack>
    </ListItem>
  );
}

export default ConnectionListItem;

import { useEffect, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Divider,
  Group,
  SizableText,
  XGroup,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import {
  AccountSelectorTriggerDAppComponent,
  AccountSelectorTriggerDappConnection,
} from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerDApp';
import { NetworkSelectorTriggerDappConnection } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IAccountSelectorActiveAccountInfo,
  IAccountSelectorRouteParams,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  mockPresetNetworksBtcList,
  mockPresetNetworksEvmList,
} from '@onekeyhq/kit-bg/src/mock';
import { getNetworkImplsFromDappScope } from '@onekeyhq/shared/src/background/backgroundUtils';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export type IHandleAccountChanged = (
  activeAccount: IAccountSelectorActiveAccountInfo,
) => void;

export function AccountListPureRendererItem({
  accountId,
}: {
  accountId: string;
}) {
  const [account, setAccount] = useState<IDBAccount | undefined>();
  useEffect(() => {
    backgroundApiProxy.serviceAccount
      .getAccount({
        accountId,
      })
      .then((a) => setAccount(a))
      .catch(() => {});
  }, [accountId]);
  return (
    <XGroup
      bg="$bg"
      borderRadius="$3"
      borderColor="$borderSubdued"
      borderWidth={StyleSheet.hairlineWidth}
      separator={<Divider vertical />}
      disabled
    >
      <Group.Item>
        {/* <NetworkSelectorTriggerDappConnection num={num} /> */}
        <AccountSelectorTriggerDAppComponent
          account={account}
          accountName="AAAA"
        />
      </Group.Item>
      <Group.Item>
        <AccountSelectorTriggerDAppComponent
          account={account}
          accountName="AAAA"
        />
      </Group.Item>
    </XGroup>
  );
}

function AccountListItem({
  num,
  handleAccountChanged,
}: {
  num: number;
  handleAccountChanged: IHandleAccountChanged;
}) {
  const { activeAccount } = useActiveAccount({ num });

  useEffect(() => {
    handleAccountChanged(activeAccount);
  }, [activeAccount, handleAccountChanged]);

  return (
    <XGroup
      bg="$bg"
      borderRadius="$3"
      borderColor="$borderSubdued"
      borderWidth={StyleSheet.hairlineWidth}
      separator={<Divider vertical />}
      disabled
    >
      <Group.Item>
        <NetworkSelectorTriggerDappConnection num={num} />
      </Group.Item>
      <Group.Item>
        <AccountSelectorTriggerDappConnection num={num} />
      </Group.Item>
    </XGroup>
  );
}

function AccountListItemProvider({
  sceneName,
  sceneUrl,
  num,
  handleAccountChanged,
  scopeNetworks,
}: IAccountSelectorRouteParams & {
  handleAccountChanged: IHandleAccountChanged;
  scopeNetworks: IServerNetwork[] | null;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName,
        sceneUrl,
        networks: Array.isArray(scopeNetworks) ? scopeNetworks : undefined,
      }}
      enabledNum={[num]}
    >
      <AccountListItem num={num} handleAccountChanged={handleAccountChanged} />
    </AccountSelectorProviderMirror>
  );
}

function DAppAccountListStandAloneItem({
  handleAccountChanged,
}: {
  handleAccountChanged: IHandleAccountChanged;
}) {
  const { serviceDApp } = backgroundApiProxy;
  const { $sourceInfo } = useDappQuery();
  const [accountSelectorNum, setAccountSelectorNum] = useState<number | null>(
    null,
  );
  const [scopeNetworks, setScopeNetworks] = useState<IServerNetwork[] | null>(
    null,
  );
  useEffect(() => {
    if (!$sourceInfo?.origin || !$sourceInfo.scope) {
      return;
    }
    serviceDApp
      .getAccountSelectorNum({
        origin: $sourceInfo.origin,
        scope: $sourceInfo.scope ?? '',
      })
      .then((num) => {
        setAccountSelectorNum(num);
      })
      .catch((e) => {
        console.error('getAccountSelectorNum error: ', e);
      });
    const impls = getNetworkImplsFromDappScope($sourceInfo.scope);
    const networks = impls?.some((impl) => impl === IMPL_EVM)
      ? mockPresetNetworksEvmList
      : mockPresetNetworksBtcList;
    setScopeNetworks(networks);
  }, [$sourceInfo?.origin, $sourceInfo?.scope, serviceDApp]);

  return (
    <YStack space="$2">
      <SizableText size="$headingMd" color="$text">
        Accounts
      </SizableText>
      {accountSelectorNum === null ? null : (
        <AccountListItemProvider
          sceneName={EAccountSelectorSceneName.discover}
          sceneUrl={$sourceInfo?.origin}
          num={accountSelectorNum}
          handleAccountChanged={handleAccountChanged}
          scopeNetworks={scopeNetworks}
        />
      )}
    </YStack>
  );
}

export { AccountListItem, DAppAccountListStandAloneItem };

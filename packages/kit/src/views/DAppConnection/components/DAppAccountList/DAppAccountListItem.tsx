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
import { AccountSelectorTriggerDappConnection } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger';
import { NetworkSelectorTriggerDappConnection } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IAccountSelectorActiveAccountInfo,
  IAccountSelectorRouteParams,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export type IHandleAccountChanged = (
  activeAccount: IAccountSelectorActiveAccountInfo,
) => void;

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
    >
      <Group.Item>
        <NetworkSelectorTriggerDappConnection num={num} />
        {/* <YStack w="$10" h="$10" bg="$bgActive" /> */}
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
}: IAccountSelectorRouteParams & {
  handleAccountChanged: IHandleAccountChanged;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName,
        sceneUrl,
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
        />
      )}
    </YStack>
  );
}

export { AccountListItem, DAppAccountListStandAloneItem };

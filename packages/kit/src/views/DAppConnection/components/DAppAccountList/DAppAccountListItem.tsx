import { useEffect } from 'react';

import { StyleSheet } from 'react-native';

import {
  Divider,
  Group,
  SizableText,
  Stack,
  XGroup,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  NetworkSelectorTriggerDappConnection,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorTriggerDappConnection } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerDApp';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IAccountSelectorAvailableNetworksMap } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getNetworkImplsFromDappScope } from '@onekeyhq/shared/src/background/backgroundUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EConnectionType } from '@onekeyhq/shared/types/dappConnection';

import { useHandleDiscoveryAccountChanged } from '../../hooks/useHandleAccountChanged';

import type { IHandleAccountChanged } from '../../hooks/useHandleAccountChanged';

function DAppAccountListInitFromHome({ num }: { num: number }) {
  const actions = useAccountSelectorActions();
  useEffect(() => {
    void (async () => {
      // required delay here, should be called after AccountSelectEffects AutoSelect
      await timerUtils.wait(600);
      await actions.current.syncFromScene({
        from: {
          sceneName: EAccountSelectorSceneName.home,
          sceneNum: 0,
        },
        num, // TODO multiple account selector of wallet connect
      });
    })();
  }, [actions, num]);
  return null;
}

function DAppAccountListItem({
  num,
  handleAccountChanged,
  readonly,
  networkReadonly,
  compressionUiMode,
  initFromHome,
  beforeShowTrigger,
}: {
  num: number;
  handleAccountChanged?: IHandleAccountChanged;
  readonly?: boolean;
  networkReadonly?: boolean;
  compressionUiMode?: boolean;
  initFromHome?: boolean;
  beforeShowTrigger?: () => Promise<void>;
}) {
  useHandleDiscoveryAccountChanged({
    num,
    handleAccountChanged,
  });

  const shouldSyncFromHome = initFromHome && !readonly;
  const loadingDuration = shouldSyncFromHome ? 800 : 500;
  return (
    <>
      <XGroup
        bg="$bg"
        borderRadius="$3"
        borderColor="$borderSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        separator={<Divider vertical />}
        disabled={readonly}
      >
        <Group.Item>
          <NetworkSelectorTriggerDappConnection
            num={num}
            beforeShowTrigger={beforeShowTrigger}
            disabled={networkReadonly || readonly}
            loadingDuration={loadingDuration}
          />
        </Group.Item>
        <Group.Item>
          <AccountSelectorTriggerDappConnection
            num={num}
            compressionUiMode={compressionUiMode}
            beforeShowTrigger={beforeShowTrigger}
            loadingDuration={loadingDuration}
          />
        </Group.Item>
      </XGroup>
      {shouldSyncFromHome ? <DAppAccountListInitFromHome num={num} /> : null}
    </>
  );
}

function DAppAccountListStandAloneItem({
  readonly,
  handleAccountChanged,
}: {
  readonly?: boolean;
  handleAccountChanged?: IHandleAccountChanged;
}) {
  const { serviceDApp, serviceNetwork } = backgroundApiProxy;
  const { $sourceInfo, connectType } = useDappQuery<{
    connectType?: EConnectionType;
  }>();

  const { result } = usePromiseResult(async () => {
    if (!$sourceInfo?.origin || !$sourceInfo.scope) {
      return {
        accountSelectorNum: null,
        networkIds: null,
      };
    }
    const impls = getNetworkImplsFromDappScope($sourceInfo.scope);
    const networkIds = impls
      ? (await serviceNetwork.getNetworkIdsByImpls({ impls })).networkIds
      : null;

    if (connectType === EConnectionType.ModifyAccount) {
      const accountsInfo = await serviceDApp.getConnectedAccountsInfo({
        origin: $sourceInfo.origin,
        scope: $sourceInfo.scope ?? '',
        isWalletConnectRequest: $sourceInfo.isWalletConnectRequest,
      });
      if (
        Array.isArray(accountsInfo) &&
        accountsInfo.length > 0 &&
        typeof accountsInfo[0]?.num === 'number'
      ) {
        return {
          accountSelectorNum: accountsInfo[0].num,
          networkIds,
        };
      }
    }

    const accountSelectorNum = await serviceDApp.getAccountSelectorNum({
      origin: $sourceInfo.origin,
      scope: $sourceInfo.scope ?? '',
      isWalletConnectRequest: $sourceInfo.isWalletConnectRequest,
    });

    return {
      accountSelectorNum,
      networkIds,
    };
  }, [
    $sourceInfo?.origin,
    $sourceInfo?.scope,
    $sourceInfo?.isWalletConnectRequest,
    serviceDApp,
    serviceNetwork,
    connectType,
  ]);

  return (
    <YStack space="$2" testID="DAppAccountListStandAloneItem">
      <SizableText size="$headingMd" color="$text">
        Accounts
      </SizableText>
      {typeof result?.accountSelectorNum === 'number' &&
      Array.isArray(result?.networkIds) ? (
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.discover,
            sceneUrl: $sourceInfo?.origin,
            // networks: scopeNetworks,
          }}
          enabledNum={[result.accountSelectorNum]}
          availableNetworksMap={{
            [result.accountSelectorNum]: { networkIds: result.networkIds },
          }}
        >
          <DAppAccountListItem
            initFromHome={connectType !== EConnectionType.ModifyAccount}
            num={result?.accountSelectorNum}
            handleAccountChanged={handleAccountChanged}
            readonly={readonly}
          />
        </AccountSelectorProviderMirror>
      ) : null}
    </YStack>
  );
}

function WalletConnectAccountTriggerList({
  sceneUrl,
  sessionAccountsInfo,
  handleAccountChanged,
}: {
  sceneUrl: string;
  sessionAccountsInfo: {
    accountSelectorNum: number;
    networkIds: (string | undefined)[];
  }[];
  handleAccountChanged?: IHandleAccountChanged;
}) {
  const enabledNum = sessionAccountsInfo.map((i) => i.accountSelectorNum);
  const availableNetworksMap = sessionAccountsInfo.reduce(
    (acc, accountInfo) => {
      const networkIds = accountInfo.networkIds.filter(Boolean);
      acc[accountInfo.accountSelectorNum] = {
        networkIds,
        defaultNetworkId: networkIds[0],
      };
      return acc;
    },
    {} as IAccountSelectorAvailableNetworksMap,
  );
  return (
    <YStack space="$2">
      <SizableText size="$headingMd" color="$text">
        Accounts
      </SizableText>
      {Array.isArray(sessionAccountsInfo) && sessionAccountsInfo.length ? (
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.discover,
            sceneUrl,
          }}
          enabledNum={enabledNum}
          availableNetworksMap={availableNetworksMap}
        >
          <YStack space="$2">
            {sessionAccountsInfo.map((i) => (
              <Stack key={i.accountSelectorNum}>
                <DAppAccountListItem
                  initFromHome
                  num={i.accountSelectorNum}
                  handleAccountChanged={handleAccountChanged}
                />
              </Stack>
            ))}
          </YStack>
        </AccountSelectorProviderMirror>
      ) : null}
    </YStack>
  );
}

export {
  DAppAccountListItem,
  DAppAccountListStandAloneItem,
  WalletConnectAccountTriggerList,
};

import { useEffect } from 'react';

import { StyleSheet } from 'react-native';

import {
  Divider,
  Group,
  SizableText,
  XGroup,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerDappConnection,
  NetworkSelectorTriggerDappConnection,
} from '@onekeyhq/kit/src/components/AccountSelector';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getNetworkImplsFromDappScope } from '@onekeyhq/shared/src/background/backgroundUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useHandleDiscoveryAccountChanged } from '../../hooks/useHandleAccountChanged';

import type { IHandleAccountChanged } from '../../hooks/useHandleAccountChanged';

function AccountListItem({
  num,
  handleAccountChanged,
  readonly,
  compressionUiMode,
  beforeShowTrigger,
}: {
  num: number;
  handleAccountChanged?: IHandleAccountChanged;
  readonly?: boolean;
  compressionUiMode?: boolean;
  beforeShowTrigger?: () => Promise<void>;
}) {
  useHandleDiscoveryAccountChanged({
    num,
    handleAccountChanged,
  });

  return (
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
        />
      </Group.Item>
      <Group.Item>
        <AccountSelectorTriggerDappConnection
          num={num}
          compressionUiMode={compressionUiMode}
          beforeShowTrigger={beforeShowTrigger}
        />
      </Group.Item>
    </XGroup>
  );
}

function DAppAccountListSyncFromHome({ num }: { num: number }) {
  const actions = useAccountSelectorActions();
  useEffect(() => {
    void (async () => {
      // required delay here, should be called after AccountSelectEffects AutoSelect
      await timerUtils.wait(300);
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

function DAppAccountListStandAloneItem({
  readonly,
  handleAccountChanged,
}: {
  readonly?: boolean;
  handleAccountChanged?: IHandleAccountChanged;
}) {
  const { serviceDApp, serviceNetwork } = backgroundApiProxy;
  const { $sourceInfo } = useDappQuery();
  console.log('=====>>>>>DAppAccountListStandAloneItem');

  const { result } = usePromiseResult(async () => {
    if (!$sourceInfo?.origin || !$sourceInfo.scope) {
      return {
        accountSelectorNum: null,
        networkIds: null,
      };
    }
    const accountSelectorNum = await serviceDApp.getAccountSelectorNum({
      origin: $sourceInfo.origin,
      scope: $sourceInfo.scope ?? '',
    });
    const impls = getNetworkImplsFromDappScope($sourceInfo.scope);
    const networkIds = impls
      ? (await serviceNetwork.getNetworkIdsByImpls({ impls })).networkIds
      : null;

    return {
      accountSelectorNum,
      networkIds,
    };
  }, [$sourceInfo?.origin, $sourceInfo?.scope, serviceDApp, serviceNetwork]);

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
          <DAppAccountListSyncFromHome num={result?.accountSelectorNum} />

          {/* <AccountSelectorSyncButton
            from={{
              sceneName: EAccountSelectorSceneName.home,
              sceneNum: 0,
            }}
            num={result?.accountSelectorNum}
          /> */}

          <AccountListItem
            num={result?.accountSelectorNum}
            handleAccountChanged={handleAccountChanged}
            readonly={readonly}
          />
        </AccountSelectorProviderMirror>
      ) : null}
    </YStack>
  );
}

export { AccountListItem, DAppAccountListStandAloneItem };

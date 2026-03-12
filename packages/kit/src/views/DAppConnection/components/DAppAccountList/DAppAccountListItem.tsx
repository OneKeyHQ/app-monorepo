import { useEffect, useRef } from 'react';

import { isNumber } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Divider,
  SizableText,
  Stack,
  YGroup,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  NetworkSelectorTriggerDappConnection,
} from '@onekeyhq/kit/src/components/AccountSelector';
import {
  AccountSelectorTriggerDappConnection,
  AccountSelectorTriggerDappConnectionCmp,
} from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerDApp';
import { useAccountSelectorAvailableNetworks } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorAvailableNetworks';
import { NetworkSelectorTriggerDappConnectionCmp } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger/NetworkSelectorTriggerDApp';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IAccountSelectorAvailableNetworksMap } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAccountSelectorActions,
  useAccountSelectorSyncLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getNetworkImplsFromDappScope } from '@onekeyhq/shared/src/background/backgroundUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { useHandleDiscoveryAccountChanged } from '../../hooks/useHandleAccountChanged';

import type { IHandleAccountChanged } from '../../hooks/useHandleAccountChanged';

type IReadonlyDAppAccountData = {
  account: INetworkAccount | undefined;
  network: IServerNetwork | undefined;
  wallet: IDBWallet | undefined;
  indexedAccount: IDBIndexedAccount | undefined;
};

function DAppAccountListInitFromHome({
  num,
  shouldSyncFromHome,
}: {
  num: number;
  shouldSyncFromHome: boolean;
}) {
  const [, setSyncLoading] = useAccountSelectorSyncLoadingAtom();
  const actions = useAccountSelectorActions();

  const availableNetworks = useAccountSelectorAvailableNetworks({
    num,
  });
  const availableNetworksRef = useRef(availableNetworks);
  availableNetworksRef.current = availableNetworks;

  useEffect(() => {
    void (async () => {
      try {
        setSyncLoading((v) => ({
          ...v,
          [num]: {
            isLoading: true,
          },
        }));
        // required delay here, should be called after AccountSelectEffects AutoSelect
        await timerUtils.wait(800);
        if (shouldSyncFromHome) {
          // alert('syncFromScene home');
          await actions.current.syncFromScene({
            from: {
              sceneName: EAccountSelectorSceneName.home,
              sceneNum: 0,
            },
            num, // TODO multiple account selector of wallet connect
            withNetworkSync: true,
            availableNetworks: availableNetworksRef.current,
          });
        }
      } finally {
        if (shouldSyncFromHome) {
          await timerUtils.wait(300);
        }
        setSyncLoading((v) => ({
          ...v,
          [num]: {
            isLoading: false,
          },
        }));
      }
    })();

    return () => {
      setSyncLoading((v) => ({
        ...v,
        [num]: {
          isLoading: false,
        },
      }));
    };
  }, [actions, num, setSyncLoading, shouldSyncFromHome]);
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getLoadingDuration = ({
  skeletonRenderDuration,
  shouldSyncFromHome,
}: {
  skeletonRenderDuration?: number;
  shouldSyncFromHome?: boolean;
}) => {
  if (skeletonRenderDuration) {
    return skeletonRenderDuration;
  }
  const syncFromHomeDuration = platformEnv.isNative ? 1200 : 1000;
  const normalLoadingDuration = platformEnv.isNative ? 800 : 500;
  return shouldSyncFromHome ? syncFromHomeDuration : normalLoadingDuration;
};

function DAppAccountListItem({
  num,
  handleAccountChanged,
  readonly,
  networkReadonly,
  // compressionUiMode,
  initFromHome,
  beforeShowTrigger,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  skeletonRenderDuration,
}: {
  num: number;
  handleAccountChanged?: IHandleAccountChanged;
  readonly?: boolean;
  networkReadonly?: boolean;
  // compressionUiMode?: boolean;
  initFromHome?: boolean;
  beforeShowTrigger?: () => Promise<void>;
  skeletonRenderDuration?: number;
}) {
  useHandleDiscoveryAccountChanged({
    num,
    handleAccountChanged,
  });

  const shouldSyncFromHome = Boolean(initFromHome && !readonly);

  // const loadingDuration = getLoadingDuration({
  // skeletonRenderDuration,
  // shouldSyncFromHome,
  // });
  const loadingDuration = 0; // useAccountSelectorSyncLoadingAtom will handle loading

  return (
    <>
      <YGroup
        bg="$bg"
        borderRadius="$3"
        borderColor="$borderSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        separator={<Divider />}
        disabled={readonly}
      >
        <YGroup.Item>
          <NetworkSelectorTriggerDappConnection
            num={num}
            beforeShowTrigger={beforeShowTrigger}
            disabled={networkReadonly || readonly}
            loadingDuration={loadingDuration}
          />
        </YGroup.Item>
        <YGroup.Item>
          <AccountSelectorTriggerDappConnection
            num={num}
            // compressionUiMode={compressionUiMode}
            beforeShowTrigger={beforeShowTrigger}
            loadingDuration={loadingDuration}
          />
        </YGroup.Item>
      </YGroup>
      <DAppAccountListInitFromHome
        num={num}
        shouldSyncFromHome={shouldSyncFromHome}
      />
    </>
  );
}

export type IConnectedAccountInfoChangedParams = {
  num: number;
  existConnectedAccount: boolean;
};
function DAppAccountListStandAloneItem({
  readonly,
  handleAccountChanged,
  onConnectedAccountInfoChanged,
}: {
  readonly?: boolean;
  handleAccountChanged?: IHandleAccountChanged;
  onConnectedAccountInfoChanged?: (
    params: IConnectedAccountInfoChangedParams,
  ) => void;
}) {
  const intl = useIntl();
  const { serviceDApp, serviceNetwork } = backgroundApiProxy;
  const { $sourceInfo } = useDappQuery();

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
        existConnectedAccount: true,
      };
    }

    const accountSelectorNum = await serviceDApp.getAccountSelectorNum({
      origin: $sourceInfo.origin,
      scope: $sourceInfo.scope ?? '',
      isWalletConnectRequest: $sourceInfo.isWalletConnectRequest,
    });

    return {
      accountSelectorNum,
      networkIds,
      existConnectedAccount: false,
    };
  }, [
    $sourceInfo?.origin,
    $sourceInfo?.scope,
    $sourceInfo?.isWalletConnectRequest,
    serviceDApp,
    serviceNetwork,
  ]);

  useEffect(() => {
    if (isNumber(result?.accountSelectorNum) && onConnectedAccountInfoChanged) {
      onConnectedAccountInfoChanged({
        num: result.accountSelectorNum,
        existConnectedAccount: result.existConnectedAccount,
      });
    }
  }, [
    result?.accountSelectorNum,
    result?.existConnectedAccount,
    onConnectedAccountInfoChanged,
  ]);

  return (
    <YStack gap="$2" testID="DAppAccountListStandAloneItem">
      <SizableText size="$headingMd" color="$text">
        {intl.formatMessage({ id: ETranslations.global_accounts })}
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
            initFromHome={!result?.existConnectedAccount}
            num={result?.accountSelectorNum}
            handleAccountChanged={handleAccountChanged}
            readonly={readonly}
          />
        </AccountSelectorProviderMirror>
      ) : null}
    </YStack>
  );
}

function DAppAccountListStandAloneItemForHomeScene() {
  const intl = useIntl();
  return (
    <YStack gap="$2" testID="DAppAccountListStandAloneItem">
      <SizableText size="$headingMd" color="$text">
        {intl.formatMessage({ id: ETranslations.global_accounts })}
      </SizableText>
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
        }}
        enabledNum={[0]}
      >
        <DAppAccountListItem initFromHome={false} num={0} readonly />
      </AccountSelectorProviderMirror>
    </YStack>
  );
}

function DAppAccountListStandAloneItemReadonly({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const intl = useIntl();
  const { serviceAccount, serviceNetwork } = backgroundApiProxy;
  const walletId = accountUtils.getWalletIdFromAccountId({ accountId });

  const { result, isLoading } = usePromiseResult<IReadonlyDAppAccountData>(
    async () => {
      const [account, network, wallet] = await Promise.all([
        serviceAccount.getAccount({
          accountId,
          networkId,
        }),
        serviceNetwork.getNetwork({
          networkId,
        }),
        serviceAccount.getWallet({
          walletId,
        }),
      ]);

      let indexedAccount;
      if (account?.indexedAccountId) {
        indexedAccount = await serviceAccount.getIndexedAccount({
          id: account.indexedAccountId,
        });
      }

      return {
        account,
        network,
        wallet,
        indexedAccount,
      };
    },
    [accountId, networkId, serviceAccount, serviceNetwork, walletId],
    {
      initResult: {
        account: undefined,
        network: undefined,
        wallet: undefined,
        indexedAccount: undefined,
      },
    },
  );

  return (
    <YStack gap="$2" testID="DAppAccountListStandAloneItem">
      <SizableText size="$headingMd" color="$text">
        {intl.formatMessage({ id: ETranslations.global_accounts })}
      </SizableText>
      <YGroup
        bg="$bg"
        borderRadius="$3"
        borderColor="$borderSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        separator={<Divider />}
        disabled
      >
        <YGroup.Item>
          <NetworkSelectorTriggerDappConnectionCmp
            network={result.network}
            isLoading={isLoading}
            triggerDisabled
          />
        </YGroup.Item>
        <YGroup.Item>
          <AccountSelectorTriggerDappConnectionCmp
            wallet={result.wallet}
            account={result.account}
            indexedAccount={result.indexedAccount}
            isLoading={isLoading}
            triggerDisabled
          />
        </YGroup.Item>
      </YGroup>
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
    <YStack gap="$2">
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
          <YStack gap="$2">
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
  DAppAccountListStandAloneItemForHomeScene,
  DAppAccountListStandAloneItemReadonly,
  WalletConnectAccountTriggerList,
};

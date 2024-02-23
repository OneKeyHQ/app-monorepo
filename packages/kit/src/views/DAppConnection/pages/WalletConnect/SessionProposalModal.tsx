import { useCallback, useEffect, useMemo, useState } from 'react';

import { buildApprovedNamespaces } from '@walletconnect/utils';

import { Page, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerDappConnection,
  NetworkSelectorTriggerDappConnection,
} from '@onekeyhq/kit/src/components/AccountSelector';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import type { INamespaceUnion } from '@onekeyhq/shared/src/walletConnect/chainsData';
import {
  getChainData,
  getNetworkImplByNamespace,
} from '@onekeyhq/shared/src/walletConnect/chainsData';
import {
  EIP155_EVENTS,
  EIP155_SIGNING_METHODS,
} from '@onekeyhq/shared/src/walletConnect/EIP155Data';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';

import type { Web3WalletTypes } from '@walletconnect/web3wallet';

function SessionProposalModal({
  origin,
  num,
}: {
  origin: string;
  num: number;
}) {
  const { $sourceInfo, proposal } = useDappQuery<{
    proposal: Web3WalletTypes.SessionProposal;
  }>();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });

  useEffect(() => {
    console.log('activeAccount: ', activeAccount);
  }, [activeAccount]);

  const requestedChains = useMemo(() => {
    if (!proposal) return [];
    const required = [];
    for (const [key, values] of Object.entries(
      proposal.params.requiredNamespaces,
    )) {
      const chains = key.includes(':') ? key : values.chains ?? [];
      required.push(chains);
    }

    const optional = [];
    for (const [key, values] of Object.entries(
      proposal.params.optionalNamespaces,
    )) {
      const chains = key.includes(':') ? key : values.chains ?? [];
      optional.push(chains);
    }
    console.log('requestedChains', [
      ...new Set([...required.flat(), ...optional.flat()]),
    ]);
    return [...new Set([...required.flat(), ...optional.flat()])];
  }, [proposal]);

  // the chains that are supported by the wallet from the proposal
  const supportedChains = useMemo(
    () => requestedChains.map((chain) => getChainData(chain)),
    [requestedChains],
  );

  const getAccountAddress = useCallback(
    (namespaces: string, account: IAccountSelectorActiveAccountInfo) => {
      if (namespaces === 'eip155') {
        // TODO: get account address by namespace
        return account?.account?.address ?? '';
      }
      return '';
    },
    [],
  );

  const supportedNamespaces = useMemo(() => {
    const namespaces: Record<
      string,
      {
        chains: string[];
        methods: string[];
        events: string[];
        accounts: string[];
      }
    > = {};
    const eip155Chains = requestedChains.filter((c) => c?.includes('eip155'));
    if (supportedChains.some((c) => c?.namespace === 'eip155')) {
      namespaces.eip155 = {
        chains: eip155Chains,
        methods: Object.values(EIP155_SIGNING_METHODS),
        events: Object.values(EIP155_EVENTS),
        accounts: eip155Chains.map(
          (chain) => `${chain}:${getAccountAddress('eip155', activeAccount)}`,
        ),
      };
    }
    return namespaces;
    // should update when activeAccount changed
  }, [getAccountAddress, requestedChains, supportedChains, activeAccount]);

  const accountsInfo = useMemo<IConnectionAccountInfo[]>(() => {
    const connectionAccounts = [];
    for (const namespace of Object.keys(supportedNamespaces)) {
      const networkImpl = getNetworkImplByNamespace(
        namespace as INamespaceUnion,
      );
      const accountInfo: IConnectionAccountInfo = {
        networkImpl,
        walletId: activeAccount.wallet?.id ?? '',
        indexedAccountId: activeAccount.indexedAccount?.id ?? '',
        networkId: activeAccount.network?.id ?? '',
        accountId: activeAccount.account?.id ?? '',
        address: activeAccount.account?.address ?? '',
        deriveType: activeAccount?.deriveType ?? 'default',

        focusedWallet: selectedAccount?.focusedWallet,
        othersWalletAccountId: selectedAccount?.othersWalletAccountId,
      };
      connectionAccounts.push(accountInfo);
    }
    return connectionAccounts;
  }, [activeAccount, supportedNamespaces, selectedAccount]);

  const onApproval = useCallback(() => {
    const approvedNamespaces = buildApprovedNamespaces({
      proposal: proposal.params,
      supportedNamespaces,
    });
    void dappApprove.resolve({
      result: {
        approvedNamespaces,
        accountsInfo,
      },
    });
    return Promise.resolve(true);
  }, [proposal?.params, supportedNamespaces, dappApprove, accountsInfo]);

  return (
    <Page>
      <Page.Header title="Wallet Connect Session Proposal" />
      <AccountSelectorTriggerDappConnection num={num} />
      <NetworkSelectorTriggerDappConnection num={num} />
      <Page.Body>
        <Stack space="$3">
          <SizableText>WalletConnect 授权账户</SizableText>
          <Stack>
            {Object.entries(supportedNamespaces).map(
              ([namespace, { chains, accounts }]) => (
                <Stack key={namespace}>
                  <SizableText>Namespace: {namespace}</SizableText>
                  {chains.map((_, index) => {
                    const accountItem = accounts[index];
                    return (
                      <SizableText key={`${accountItem}`}>
                        {accountItem}
                      </SizableText>
                    );
                  })}
                </Stack>
              ),
            )}
          </Stack>
        </Stack>
      </Page.Body>
      <Page.Footer
        onConfirmText="Approval"
        onCancelText="Reject"
        onConfirm={onApproval}
        onCancel={() => {
          dappApprove.reject();
        }}
      />
    </Page>
  );
}

function SessionProposalModalProvider() {
  const { proposal } = useDappQuery<{
    proposal: Web3WalletTypes.SessionProposal;
  }>();

  const [accountSelectorNum, setAccountSelectorNum] = useState<number | null>(
    null,
  );
  const { origin } = new URL(proposal.params.proposer.metadata.url);
  useEffect(() => {
    if (!proposal) {
      return;
    }
    backgroundApiProxy.serviceDApp
      .getAccountSelectorNum({
        origin,
        scope: 'ethereum',
        options: {
          networkImpl: IMPL_EVM,
        },
      })
      .then((num) => {
        setAccountSelectorNum(num);
      })
      .catch((e) => {
        console.error('getAccountSelectorNum error: ', e);
      });
  }, [proposal, origin]);

  return (
    <>
      {accountSelectorNum === null ? null : (
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.discover,
            sceneUrl: origin,
          }}
          enabledNum={[accountSelectorNum]}
        >
          <SessionProposalModal origin={origin} num={accountSelectorNum} />
        </AccountSelectorProviderMirror>
      )}
    </>
  );
}

export default SessionProposalModalProvider;

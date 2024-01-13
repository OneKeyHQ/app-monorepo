import { useCallback, useEffect, useMemo } from 'react';

import { buildApprovedNamespaces } from '@walletconnect/utils';

import { Button, Page, SizableText, Stack } from '@onekeyhq/components';
import { AccountSelectorProvider } from '@onekeyhq/kit/src/components/AccountSelector';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { getChainData } from '../data/chainsUtils';
import { EIP155_EVENTS, EIP155_SIGNING_METHODS } from '../data/EIP155Data';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';
import type { Web3WalletTypes } from '@walletconnect/web3wallet';

function SessionProposalModal() {
  const { $sourceInfo, proposal } = useDappQuery<{
    proposal: Web3WalletTypes.SessionProposal;
  }>();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });
  const { activeAccount } = useActiveAccount({ num: 0 });
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();

  useEffect(() => {
    void (async () => {
      console.log('activeAccount: ', activeAccount);
      const { account } = activeAccount;

      // set default account
      if (!account) {
        const { wallets } =
          await backgroundApiProxy.serviceAccount.getHDWallets();
        const defaultWallet = wallets[0];
        const accounts =
          await backgroundApiProxy.serviceAccount.getAccountsOfWallet({
            walletId: defaultWallet.id,
          });
        console.log('accounts: ', accounts);
        const defaultAccount = accounts.accounts[0];
        void actions.current.reloadActiveAccountInfo({
          num: 0,
          selectedAccount: {
            walletId: defaultWallet.id,
            indexedAccountId: defaultAccount.id,
            othersWalletAccountId: undefined,
            networkId: 'evm--1',
            deriveType: 'default',
            focusedWallet: defaultWallet.id,
          },
        });
      }
    })();
  }, [activeAccount, actions]);

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

  const onApproval = useCallback(() => {
    const approvedNamespaces = buildApprovedNamespaces({
      proposal: proposal.params,
      supportedNamespaces,
    });
    void dappApprove.resolve({
      result: approvedNamespaces,
    });
    return Promise.resolve(true);
  }, [proposal?.params, supportedNamespaces, dappApprove]);

  return (
    <Page>
      <Page.Header title="Wallet Connect Session Proposal" />
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
  return (
    <AccountSelectorProvider
      config={{
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: proposal.params.proposer.metadata.url,
      }}
      enabledNum={[0]}
    >
      <SessionProposalModal />
    </AccountSelectorProvider>
  );
}

export default SessionProposalModalProvider;

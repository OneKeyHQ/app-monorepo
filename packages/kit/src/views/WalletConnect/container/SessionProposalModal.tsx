import { useCallback, useEffect, useMemo } from 'react';

import { buildApprovedNamespaces } from '@walletconnect/utils';

import { IPageNavigationProp, Page, Stack, Text } from '@onekeyhq/components';
import { AccountSelectorProvider } from '@onekeyhq/kit/src/components/AccountSelector';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { getChainData } from '../data/chainsUtils';
import { EIP155_EVENTS, EIP155_SIGNING_METHODS } from '../data/EIP155Data';

import type { Web3WalletTypes } from '@walletconnect/web3wallet';

function SessionProposalModal() {
  const { $sourceInfo, proposal } = useDappQuery<{
    proposal: Web3WalletTypes.SessionProposal;
  }>();
  console.log('====>$: ', $sourceInfo, proposal);
  const { activeAccount, activeAccountName } = useActiveAccount({ num: 0 });
  useEffect(() => {
    console.log('====>activeAccount: ', activeAccount);
    console.log('====>activeAccountName: ', activeAccountName);
    console.log(getChainData('eip155:1'));
  }, [activeAccount, activeAccountName]);

  const requestedChains = useMemo(() => {
    if (!proposal) return [];
    const required = [];
    for (const [key, values] of Object.entries(
      proposal.params.requiredNamespaces,
    )) {
      const chains = key.includes(':') ? key : values.chains;
      required.push(chains);
    }

    const optional = [];
    for (const [key, values] of Object.entries(
      proposal.params.optionalNamespaces,
    )) {
      const chains = key.includes(':') ? key : values.chains;
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

  // get required chains that are not supported by the wallet
  const notSupportedChains = useMemo(() => {
    if (!proposal) return [];
    const required = [];
    for (const [key, values] of Object.entries(
      proposal.params.requiredNamespaces,
    )) {
      const chains = key.includes(':') ? key : values.chains;
      required.push(chains);
    }
    return required.flat().filter(
      (chain) =>
        !supportedChains
          .map((supportedChain) => {
            if (!supportedChain) return null;
            return `${supportedChain?.namespace}:${supportedChain?.chainId}`;
          })
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          .includes(chain!),
    );
  }, [proposal, supportedChains]);
  console.log('notSupportedChains', notSupportedChains);

  const getAccountAddress = useCallback(
    (namespaces: string) => {
      if (namespaces === 'eip155') {
        // TODO: get account address by namespace
        return activeAccount?.account?.address ?? '';
      }
      return '';
    },
    [activeAccount],
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
    const eip155Chains = requestedChains.filter((c) =>
      c?.includes('eip155'),
    ) as string[];
    if (supportedChains.some((c) => c?.namespace === 'eip155')) {
      namespaces.eip155 = {
        chains: eip155Chains,
        methods: Object.values(EIP155_SIGNING_METHODS),
        events: Object.values(EIP155_EVENTS),
        accounts: eip155Chains.map(
          (chain) => `${chain}:${getAccountAddress('eip155')}`,
        ),
      };
    }
    return namespaces;
  }, [getAccountAddress, requestedChains, supportedChains]);

  const onApproval = useCallback(() => {
    const approvedNamespaces = buildApprovedNamespaces({
      proposal: proposal.params,
      supportedNamespaces,
    });
    console.log(approvedNamespaces);
  }, [proposal?.params, supportedNamespaces]);

  return (
    <Page>
      <Page.Header title="Session Proposal" />
      <Page.Body>
        <Stack space="$3">
          <Text>Session Proposal</Text>
        </Stack>
      </Page.Body>
      <Page.Footer
        onConfirmText="Approval"
        onCancelText="Reject"
        onConfirm={onApproval}
        onCancel={() => alert('cancel')}
      />
    </Page>
  );
}

function SessionProposalModalProvider() {
  return (
    <AccountSelectorProvider
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <SessionProposalModal />
    </AccountSelectorProvider>
  );
}

export default SessionProposalModalProvider;

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { WalletConnectAccountTriggerList } from '../../components/DAppAccountList';
import { DAppRequestedPermissionContent } from '../../components/DAppRequestContent';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../../components/DAppRequestLayout';
import { useRiskDetection } from '../../hooks/useRiskDetection';

import type {
  IHandleAccountChanged,
  IHandleAccountChangedParams,
} from '../../hooks/useHandleAccountChanged';
import type { Web3WalletTypes } from '@walletconnect/web3wallet';

function SessionProposalModal() {
  const { serviceWalletConnect } = backgroundApiProxy;
  const intl = useIntl();
  const { proposal, $sourceInfo } = useDappQuery<{
    proposal: Web3WalletTypes.SessionProposal;
  }>();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });
  const { origin } = new URL(proposal.params.proposer.metadata.url);
  const favicon = proposal.params.proposer.metadata.icons[0];
  const {
    continueOperate,
    setContinueOperate,
    canContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin });

  const { result: sessionAccountsInfo } = usePromiseResult(
    async () => serviceWalletConnect.getSessionApprovalAccountInfo(proposal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serviceWalletConnect],
  );

  const [accountChangedParamsMap, setAccountChangedParamsMap] = useState<{
    [num: number]: IHandleAccountChangedParams;
  }>({});
  const confirmDisabled = useMemo(() => {
    if (!canContinueOperate) return true;
    return false;
  }, [canContinueOperate]);

  const onApproval = useCallback(
    async (close: () => void) => {
      const accountChangedParamsValues = Object.values(accountChangedParamsMap);
      if (accountChangedParamsValues.length !== sessionAccountsInfo?.length) {
        Toast.success({
          title: 'Please select all accounts',
        });
        return;
      }
      const accountsInfo = [];
      for (const accountChangedParams of accountChangedParamsValues) {
        const { activeAccount, selectedAccount } = accountChangedParams;
        if (!activeAccount.account?.address) {
          Toast.success({
            title: `Please select ${activeAccount.network?.name ?? ''} account`,
          });
          return;
        }
        const { wallet, account, network, indexedAccount } = activeAccount;
        const accountInfo = {
          networkImpl: network?.impl ?? '',
          walletId: wallet?.id ?? '',
          indexedAccountId: indexedAccount?.id ?? '',
          networkId: network?.id ?? '',
          accountId: account.id,
          address: account.address,
          deriveType: activeAccount?.deriveType ?? 'default',

          focusedWallet: selectedAccount?.focusedWallet,
          othersWalletAccountId: selectedAccount?.othersWalletAccountId,
        };
        accountsInfo.push(accountInfo);
      }
      const supportedNamespaces =
        await serviceWalletConnect.buildWalletConnectNamespace({
          proposal,
          accountsInfo,
        });
      await dappApprove.resolve({
        close,
        result: { accountsInfo, supportedNamespaces },
      });
      Toast.success({
        title: intl.formatMessage({
          id: 'content__connected',
        }),
      });
    },
    [
      intl,
      dappApprove,
      accountChangedParamsMap,
      sessionAccountsInfo,
      serviceWalletConnect,
      proposal,
    ],
  );

  const handleAccountChanged = useCallback<IHandleAccountChanged>(
    (params, num) => {
      const { activeAccount, selectedAccount } = params;
      console.log(
        'connectionmodal setActiveAccount: ',
        activeAccount.account?.id,
        num,
      );
      if (typeof num === 'number') {
        setAccountChangedParamsMap((prevAccountsMap) => ({
          ...prevAccountsMap,
          [num]: {
            activeAccount,
            selectedAccount,
          },
        }));
      }
    },
    [],
  );

  useEffect(() => {
    console.log('selectedAccountsMap: ', accountChangedParamsMap);
  }, [accountChangedParamsMap]);

  return (
    <Page scrollEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title="Connection Request"
          subtitleShown={false}
          origin={origin}
          urlSecurityInfo={urlSecurityInfo}
          favicon={favicon}
        >
          {Array.isArray(sessionAccountsInfo) ? (
            <WalletConnectAccountTriggerList
              sceneUrl={origin}
              sessionAccountsInfo={sessionAccountsInfo}
              handleAccountChanged={handleAccountChanged}
            />
          ) : null}
          <DAppRequestedPermissionContent />
        </DAppRequestLayout>
      </Page.Body>
      <Page.Footer>
        <DAppRequestFooter
          continueOperate={continueOperate}
          setContinueOperate={(value) => setContinueOperate(!!value)}
          onConfirm={onApproval}
          onCancel={() => {
            dappApprove.reject();
          }}
          confirmButtonProps={{
            disabled: confirmDisabled,
          }}
          showContinueOperateCheckbox={riskLevel !== 'security'}
          riskLevel={riskLevel}
        />
      </Page.Footer>
    </Page>
  );
}

export default SessionProposalModal;

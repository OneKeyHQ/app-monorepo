import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Toast, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

import { WalletConnectAccountTriggerList } from '../../components/DAppAccountList';
import { DAppRequestedPermissionContent } from '../../components/DAppRequestContent';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../../components/DAppRequestLayout';
import { useRiskDetection } from '../../hooks/useRiskDetection';

import type { IHandleAccountChanged } from '../../hooks/useHandleAccountChanged';
import type { Web3WalletTypes } from '@walletconnect/web3wallet';

function SessionProposalModal() {
  const { serviceDApp, serviceWalletConnect } = backgroundApiProxy;
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

  const [selectedAccountsMap, setSelectedAccountsMap] = useState<{
    [num: number]: IAccountSelectorActiveAccountInfo;
  }>({});
  const confirmDisabled = useMemo(() => {
    if (!canContinueOperate) return true;
    return false;
  }, [canContinueOperate]);

  const onApproval = useCallback(
    async ({ close }: { close: () => void }) => {
      const accounts = Object.values(selectedAccountsMap);
      if (accounts.length !== sessionAccountsInfo?.length) {
        Toast.success({
          title: 'Please select all accounts',
        });
        return;
      }
      const accountsInfo = [];
      for (const activeAccount of accounts) {
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
        };
        accountsInfo.push(accountInfo);
      }
      await serviceDApp.saveConnectionSession({
        origin,
        accountsInfo,
        storageType: 'walletConnect',
      });
      await dappApprove.resolve({
        close,
        result: accountsInfo,
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
      serviceDApp,
      origin,
      selectedAccountsMap,
      sessionAccountsInfo,
    ],
  );

  const handleAccountChanged = useCallback<IHandleAccountChanged>(
    (activeAccount, num) => {
      console.log(
        'connectionmodal setActiveAccount: ',
        activeAccount.account?.id,
        num,
      );
      if (typeof num === 'number') {
        setSelectedAccountsMap((prevAccountsMap) => ({
          ...prevAccountsMap,
          [num]: activeAccount,
        }));
      }
    },
    [],
  );

  useEffect(() => {
    console.log('selectedAccountsMap: ', selectedAccountsMap);
  }, [selectedAccountsMap]);

  return (
    <Page scrollEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title="Connection Request"
          origin={origin}
          urlSecurityInfo={urlSecurityInfo}
          favicon={favicon}
        >
          {Array.isArray(sessionAccountsInfo) && (
            <WalletConnectAccountTriggerList
              sceneUrl={origin}
              sessionAccountsInfo={sessionAccountsInfo}
              handleAccountChanged={handleAccountChanged}
            />
          )}
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

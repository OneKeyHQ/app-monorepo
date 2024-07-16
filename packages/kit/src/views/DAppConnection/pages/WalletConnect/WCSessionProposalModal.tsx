import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';

import { WalletConnectAccountTriggerList } from '../../components/DAppAccountList';
import { DAppRequestedPermissionContent } from '../../components/DAppRequestContent';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../../components/DAppRequestLayout';
import { useRiskDetection } from '../../hooks/useRiskDetection';
import DappOpenModalPage from '../DappOpenModalPage';

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
  const origin = uriUtils.safeGetWalletConnectOrigin(proposal);
  const favicon = proposal.params.proposer.metadata.icons[0];
  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: origin ?? '' });

  const { result: sessionAccountsInfo } = usePromiseResult(
    async () => serviceWalletConnect.getSessionApprovalAccountInfo(proposal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serviceWalletConnect],
  );

  const [accountChangedParamsMap, setAccountChangedParamsMap] = useState<{
    [num: number]: IHandleAccountChangedParams;
  }>({});
  const confirmDisabled = useMemo(() => {
    if (!continueOperate) return true;
    return false;
  }, [continueOperate]);

  const onApproval = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
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
        close: () => {
          close?.({ flag: EDAppModalPageStatus.Confirmed });
        },
        result: { accountsInfo, supportedNamespaces },
      });
      Toast.success({
        title: intl.formatMessage({ id: ETranslations.global_connected }),
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
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
        <Page.Header headerShown={false} />
        <Page.Body>
          <DAppRequestLayout
            title={intl.formatMessage({
              id: ETranslations.dapp_connect_connection_request,
            })}
            subtitleShown={false}
            origin={origin ?? ''}
            urlSecurityInfo={urlSecurityInfo}
            favicon={favicon}
          >
            {Array.isArray(sessionAccountsInfo) ? (
              <WalletConnectAccountTriggerList
                sceneUrl={origin ?? ''}
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
            showContinueOperateCheckbox={showContinueOperate}
            riskLevel={riskLevel}
          />
        </Page.Footer>
      </>
    </DappOpenModalPage>
  );
}

export default SessionProposalModal;

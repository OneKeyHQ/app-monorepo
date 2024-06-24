import { useCallback, useMemo, useState } from 'react';

import { isNumber } from 'lodash';
import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDAppModalPageStatus,
  type IConnectionAccountInfo,
} from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { DAppAccountListStandAloneItem } from '../components/DAppAccountList';
import { DAppRequestedPermissionContent } from '../components/DAppRequestContent';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

import DappOpenModalPage from './DappOpenModalPage';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';
import type { IConnectedAccountInfoChangedParams } from '../components/DAppAccountList';
import type { IHandleAccountChanged } from '../hooks/useHandleAccountChanged';

function ConnectionModal() {
  const intl = useIntl();
  const { serviceDApp } = backgroundApiProxy;
  const { $sourceInfo } = useDappQuery();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });
  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: $sourceInfo?.origin ?? '' });

  const [selectedAccount, setSelectedAccount] =
    useState<IAccountSelectorActiveAccountInfo | null>(null);

  const [rawSelectedAccount, setRawSelectedAccount] =
    useState<IAccountSelectorSelectedAccount | null>(null);

  const [connectedAccountInfo, setConnectedAccountInfo] =
    useState<IConnectedAccountInfoChangedParams | null>(null);

  const handleAccountChanged = useCallback<IHandleAccountChanged>(
    ({ activeAccount, selectedAccount: rawSelectedAccountData }) => {
      setSelectedAccount(activeAccount);
      setRawSelectedAccount(rawSelectedAccountData);
      console.log(
        'connectionmodal setActiveAccount: ',
        activeAccount.account?.id,
      );
    },
    [],
  );

  const subtitle = useMemo(() => {
    if (!selectedAccount?.network?.name) {
      return '';
    }
    return intl.formatMessage(
      {
        id: ETranslations.dapp_connect_allow_this_site_to_access,
      },
      {
        chain: selectedAccount?.network?.name ?? '',
      },
    );
  }, [selectedAccount?.network?.name, intl]);

  const confirmDisabled = useMemo(() => {
    if (!continueOperate) {
      return true;
    }
    if (!selectedAccount?.account?.address) {
      if (selectedAccount?.account?.addressDetail.isValid) {
        return false;
      }
      return true;
    }
    return false;
  }, [selectedAccount, continueOperate]);

  const onApproval = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      if (!$sourceInfo?.scope) {
        Toast.error({ title: 'no injected scope' });
        return;
      }
      if (!selectedAccount || !selectedAccount.account) {
        Toast.error({ title: 'no account' });
        return;
      }
      const {
        wallet,
        account,
        network,
        indexedAccount,
        deriveType = 'default',
      } = selectedAccount;
      const accountInfo: IConnectionAccountInfo = {
        networkImpl: network?.impl ?? '',
        walletId: wallet?.id ?? '',
        indexedAccountId: indexedAccount?.id ?? '',
        networkId: network?.id ?? '',
        accountId: account.id,
        address: account.address,
        deriveType,

        focusedWallet: rawSelectedAccount?.focusedWallet,
        othersWalletAccountId: rawSelectedAccount?.othersWalletAccountId,
      };
      if (connectedAccountInfo?.existConnectedAccount) {
        if (!isNumber(connectedAccountInfo?.num)) {
          dappApprove.reject();
          throw new Error('no accountSelectorNum');
        }
        await serviceDApp.updateConnectionSession({
          origin: $sourceInfo?.origin,
          updatedAccountInfo: accountInfo,
          storageType: 'injectedProvider',
          accountSelectorNum: connectedAccountInfo.num,
        });
      } else {
        await serviceDApp.saveConnectionSession({
          origin: $sourceInfo?.origin,
          accountsInfo: [accountInfo],
          storageType: 'injectedProvider',
        });
      }
      await dappApprove.resolve({
        close: () => {
          close?.({ flag: EDAppModalPageStatus.Confirmed });
        },
        result: accountInfo,
      });
      Toast.success({
        title: intl.formatMessage({ id: ETranslations.global_connected }),
      });
    },
    [
      intl,
      dappApprove,
      $sourceInfo?.origin,
      $sourceInfo?.scope,
      serviceDApp,
      selectedAccount,
      rawSelectedAccount,
      connectedAccountInfo,
    ],
  );

  return (
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
        <Page.Header headerShown={false} />
        <Page.Body>
          <DAppRequestLayout
            title={intl.formatMessage({
              id: ETranslations.dapp_connect_connection_request,
            })}
            subtitle={subtitle}
            origin={$sourceInfo?.origin ?? ''}
            urlSecurityInfo={urlSecurityInfo}
          >
            <DAppAccountListStandAloneItem
              handleAccountChanged={handleAccountChanged}
              onConnectedAccountInfoChanged={setConnectedAccountInfo}
            />
            <DAppRequestedPermissionContent />
          </DAppRequestLayout>
        </Page.Body>
        <Page.Footer>
          <DAppRequestFooter
            continueOperate={continueOperate}
            setContinueOperate={(value) => setContinueOperate(!!value)}
            onConfirm={onApproval}
            onCancel={() => dappApprove.reject()}
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

export default ConnectionModal;

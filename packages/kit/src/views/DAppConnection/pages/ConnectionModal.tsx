import { useCallback, useMemo, useState } from 'react';

import { isNumber } from 'lodash';
import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EDAppModalPageStatus,
  type IConnectionAccountInfo,
} from '@onekeyhq/shared/types/dappConnection';
import { ERookieTaskType } from '@onekeyhq/shared/types/rookieGuide';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { useKeylessWebFlowAutoConnectDapp } from '../../../hooks/useWebDapp/useKeylessWebFlow';
import { isAccountIdDeactivatedBotWallet } from '../../../utils/botWalletAccountUtils';
import { shouldWarnBotWalletInteract } from '../../../utils/botWalletStatusUtils';
import { showBotWalletDeactivatedWarningDialog } from '../../../utils/botWalletWarningDialog';
import { DAppAccountListStandAloneItem } from '../components/DAppAccountList';
import { DAppRequestedPermissionContent } from '../components/DAppRequestContent';
import { DAppRequestedDappList } from '../components/DAppRequestContent/DAppRequestedDappList';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';
import { DAppConnectionTestIDs } from '../testIDs';

import DappOpenModalPage from './DappOpenModalPage';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';
import type { IConnectedAccountInfoChangedParams } from '../components/DAppAccountList';
import type { IHandleAccountChanged } from '../hooks/useHandleAccountChanged';

function ConnectionModal() {
  const intl = useIntl();
  const { serviceDApp } = backgroundApiProxy;
  const { $sourceInfo, keylessAutoConnectNonce, preselectKeylessProvider } =
    useDappQuery<{
      keylessAutoConnectNonce?: string;
      preselectKeylessProvider?: EOAuthSocialLoginProvider;
    }>();
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
  const { notifyKeylessWebConnectSuccess } = useKeylessWebFlowAutoConnectDapp();

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
        if ($sourceInfo) {
          defaultLogger.discovery.dapp.dappUse({
            dappName: $sourceInfo?.hostname,
            dappDomain: $sourceInfo?.origin,
            action: 'ConnectWallet',
            network: selectedAccount?.network?.name,
            failReason: 'no injected scope',
          });
        }
        return;
      }
      if (!selectedAccount || !selectedAccount.account) {
        Toast.error({ title: 'no account' });
        defaultLogger.discovery.dapp.dappUse({
          dappName: $sourceInfo?.hostname,
          dappDomain: $sourceInfo?.origin,
          action: 'ConnectWallet',
          network: selectedAccount?.network?.name,
          failReason: 'no account',
        });
        return;
      }
      const isDeactivatedBotWallet = await isAccountIdDeactivatedBotWallet({
        accountId: selectedAccount.account.id,
      });
      if (
        shouldWarnBotWalletInteract({
          isBotWallet: isDeactivatedBotWallet,
          isBotWalletDeactivated: isDeactivatedBotWallet,
        })
      ) {
        const confirmed = await showBotWalletDeactivatedWarningDialog();
        if (!confirmed) {
          return;
        }
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
          defaultLogger.discovery.dapp.dappUse({
            dappName: $sourceInfo.hostname,
            dappDomain: $sourceInfo?.origin,
            action: 'ConnectWallet',
            network: network?.name,
            failReason: 'no accountSelectorNum',
          });
          throw new OneKeyLocalError('no accountSelectorNum');
        }
        await serviceDApp.updateConnectionSession({
          origin: $sourceInfo?.origin,
          updatedAccountInfo: accountInfo,
          storageType: 'injectedProvider',
          accountSelectorNum: connectedAccountInfo.num,
        });
        // updateConnectionSession does not propagate the new account up to
        // the home selector the way saveConnectionSession does. For the
        // keyless-preselect entry (Continue with Google/Apple over an
        // already-connected origin) we must mirror that propagation: under
        // AlwaysUsePrimaryAccount mode, the next eth_accounts call runs
        // alignPrimaryAccountToHomeAccount and would otherwise reverse our
        // switch back to the previously-connected non-keyless account.
        if (preselectKeylessProvider) {
          await serviceDApp.syncDappAccountIfPrimaryMode({
            origin: $sourceInfo.origin,
          });
        }
      } else {
        await serviceDApp.saveConnectionSession({
          origin: $sourceInfo?.origin,
          accountsInfo: [accountInfo],
          storageType: 'injectedProvider',
        });
      }
      if (keylessAutoConnectNonce && $sourceInfo?.origin) {
        void serviceDApp.notifyDAppAccountAndChainChangedWithCache({
          targetOrigin: $sourceInfo.origin,
        });
      }
      await dappApprove.resolve({
        close: () => {
          close?.({ flag: EDAppModalPageStatus.Confirmed });
        },
        result: accountInfo,
      });
      setTimeout(() => {
        void notifyKeylessWebConnectSuccess({
          nonce: keylessAutoConnectNonce,
        });
      }, 1500);

      defaultLogger.discovery.dapp.dappUse({
        dappName: $sourceInfo.hostname,
        dappDomain: $sourceInfo?.origin,
        action: 'ConnectWallet',
        network: network?.name,
      });
      void backgroundApiProxy.serviceRookieGuide.recordTaskCompleted(
        ERookieTaskType.DAPP,
      );
    },
    [
      dappApprove,
      $sourceInfo,
      serviceDApp,
      selectedAccount,
      rawSelectedAccount,
      connectedAccountInfo,
      keylessAutoConnectNonce,
      notifyKeylessWebConnectSuccess,
      preselectKeylessProvider,
    ],
  );

  return (
    <DappOpenModalPage
      dappApprove={dappApprove}
      testID={DAppConnectionTestIDs.ConnectionModal}
    >
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
              preselectKeylessProvider={preselectKeylessProvider}
            />
            <DAppRequestedPermissionContent />
            <DAppRequestedDappList origins={urlSecurityInfo?.dapp?.origins} />
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
              testID: DAppConnectionTestIDs.ConnectionApproveButton,
            }}
            cancelButtonProps={{
              testID: DAppConnectionTestIDs.ConnectionRejectButton,
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

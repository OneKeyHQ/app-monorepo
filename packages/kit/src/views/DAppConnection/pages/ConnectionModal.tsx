import { useCallback, useMemo, useRef, useState } from 'react';

import { isNumber } from 'lodash';
import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import type { IAccountSelectorSelectedAccount } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import {
  EDAppModalPageStatus,
  type IConnectionAccountInfo,
} from '@onekeyhq/shared/types/dappConnection';
import { ERookieTaskType } from '@onekeyhq/shared/types/rookieGuide';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import { useKeylessWebFlowAutoConnectDapp } from '../../../hooks/useWebDapp/useKeylessWebFlow';
import {
  getAccountSelectorPerfTimestamp,
  isAccountSelectorPerfDebugEnabled,
} from '../../../states/jotai/contexts/accountSelector/perfDebug';
import { isAccountIdDeactivatedBotWallet } from '../../../utils/botWalletAccountUtils';
import { shouldWarnBotWalletInteract } from '../../../utils/botWalletStatusUtils';
import { showBotWalletDeactivatedWarningDialog } from '../../../utils/botWalletWarningDialog';
import { isApprovalAccountSuperseded } from '../approvalGuard';
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
  const accountObservationRef = useRef<{
    activeAccount: IAccountSelectorActiveAccountInfo;
    count: number;
    observedAt: number;
    rawSelectedAccount: IAccountSelectorSelectedAccount;
  }>(undefined);
  // Tracks the newest observation even when it cannot be shown yet, so approval
  // can verify the modal is not about to authorize a superseded account.
  const latestActiveAccountRef =
    useRef<IAccountSelectorActiveAccountInfo | null>(null);
  const latestAccountObservationRevisionRef = useRef(0);
  const latestAccountSelectorNumRef = useRef<number | undefined>(undefined);
  const activeApprovalIdRef = useRef<string | undefined>(undefined);
  const missingScopeLoggedRef = useRef(false);

  const handleAccountChanged = useCallback<IHandleAccountChanged>(
    ({ activeAccount, selectedAccount: rawSelectedAccountData }, num) => {
      latestAccountObservationRevisionRef.current += 1;
      latestActiveAccountRef.current = activeAccount;
      latestAccountSelectorNumRef.current = num;
      const activeApprovalId = activeApprovalIdRef.current;
      if (activeApprovalId) {
        void serviceDApp
          .invalidateConnectionApproval({
            approvalId: activeApprovalId,
          })
          .catch(() => {
            // If cancellation cannot reach background, settle the original
            // request as rejected so a pending approval fails closed.
            dappApprove.reject({ isForce: true });
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_unknown_error_retry_message,
              }),
            });
          });
      }
      const hasUsableAccount = Boolean(activeAccount.account);
      if (isAccountSelectorPerfDebugEnabled()) {
        const observedAt = getAccountSelectorPerfTimestamp();
        const previous = accountObservationRef.current;
        const count = (previous?.count || 0) + 1;
        defaultLogger.accountSelector.perf.trace(
          'dappConnectionAccountObserved',
          {
            activeAccountChanged:
              previous?.activeAccount !== activeAccount || !previous,
            activeReady: activeAccount.ready,
            appliedToModal: hasUsableAccount,
            hasAccount: Boolean(activeAccount.account),
            hasAddress: Boolean(
              activeAccount.account?.address ||
              activeAccount.account?.addressDetail?.isValid,
            ),
            hasNetwork: Boolean(activeAccount.network),
            num,
            observationCount: count,
            selectedAccountChanged:
              previous?.rawSelectedAccount !== rawSelectedAccountData ||
              !previous,
            sincePreviousObservationMs: previous
              ? Math.round(observedAt - previous.observedAt)
              : undefined,
          },
        );
        accountObservationRef.current = {
          activeAccount,
          count,
          observedAt,
          rawSelectedAccount: rawSelectedAccountData,
        };
      }
      // Applies even when the account has no address yet: keeping the previous
      // account in state would render one account while approving another, and
      // confirmDisabled already blocks an account that cannot be connected.
      setSelectedAccount(activeAccount);
      setRawSelectedAccount(rawSelectedAccountData);
    },
    [dappApprove, intl, serviceDApp],
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
        // A request that arrived without a scope and one whose route query was
        // lost entirely are different failures. One value drives both the toast
        // and the log so the two can never disagree.
        const failReason = $sourceInfo ? 'no injected scope' : 'no source info';
        Toast.error({ title: failReason });
        // Logged even without $sourceInfo, which previously left that case with
        // no trace at all.
        //
        // Logged once per modal: $sourceInfo is parsed from the route query and
        // cannot change while mounted, but the confirm button stays enabled, so
        // repeated taps would emit an identical entry and an identical server
        // event every time.
        if (!missingScopeLoggedRef.current) {
          missingScopeLoggedRef.current = true;
          defaultLogger.discovery.dapp.dappUse({
            dappName: $sourceInfo?.hostname ?? '',
            dappDomain: $sourceInfo?.origin ?? '',
            action: 'ConnectWallet',
            network: selectedAccount?.network?.name,
            failReason,
          });
        }
        return;
      }
      if (!selectedAccount || !selectedAccount.account || !rawSelectedAccount) {
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
      const approvingAccountId = selectedAccount.account.id;
      const approvingObservationRevision =
        latestAccountObservationRevisionRef.current;
      // Local awaits re-check this observation. Once control moves to the
      // background transaction, approvalId invalidation and the selector intent
      // epoch guard the same account snapshot until the request is resolved.
      const rejectChangedApproval = () => {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_unknown_error_retry_message,
          }),
        });
        defaultLogger.discovery.dapp.dappUse({
          dappName: $sourceInfo?.hostname,
          dappDomain: $sourceInfo?.origin,
          action: 'ConnectWallet',
          network: selectedAccount?.network?.name,
          failReason: 'account changed during approval',
        });
      };
      const rejectIfAccountSuperseded = () => {
        if (
          !isApprovalAccountSuperseded({
            approvingAccountId,
            approvingObservationRevision,
            latestAccountId: latestActiveAccountRef.current?.account?.id,
            latestObservationRevision:
              latestAccountObservationRevisionRef.current,
          })
        ) {
          return false;
        }
        rejectChangedApproval();
        return true;
      };
      if (rejectIfAccountSuperseded()) {
        return;
      }
      const isDeactivatedBotWallet = await isAccountIdDeactivatedBotWallet({
        accountId: approvingAccountId,
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
      if (rejectIfAccountSuperseded()) {
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
      const accountSelectorNum = latestAccountSelectorNumRef.current;
      if (!isNumber(accountSelectorNum)) {
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
      let approvalFailureReason:
        | 'request-settled'
        | 'selection-changed'
        | undefined;
      const approvalId = `${String($sourceInfo.id)}:${String(
        approvingObservationRevision,
      )}:${generateUUID()}`;
      activeApprovalIdRef.current = approvalId;
      let approved = false;
      try {
        approved = await dappApprove.resolveByBackground({
          close: () => {
            close?.({ flag: EDAppModalPageStatus.Confirmed });
          },
          resolveInBackground: async (requestId) => {
            const result = await serviceDApp.approveConnectionSession({
              accountInfo,
              accountSelectorNum,
              approvalId,
              expectedSelectedAccount: rawSelectedAccount,
              mode: connectedAccountInfo?.existConnectedAccount
                ? 'update'
                : 'save',
              origin: $sourceInfo.origin,
              preselectKeylessProvider,
              requestId,
            });
            approvalFailureReason = result.reason;
            return result.approved;
          },
        });
      } finally {
        if (activeApprovalIdRef.current === approvalId) {
          activeApprovalIdRef.current = undefined;
        }
      }
      if (!approved) {
        if (approvalFailureReason === 'selection-changed') {
          rejectChangedApproval();
        }
        return;
      }
      if (keylessAutoConnectNonce && $sourceInfo?.origin) {
        void serviceDApp.notifyDAppAccountAndChainChangedWithCache({
          targetOrigin: $sourceInfo.origin,
        });
      }
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
      intl,
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

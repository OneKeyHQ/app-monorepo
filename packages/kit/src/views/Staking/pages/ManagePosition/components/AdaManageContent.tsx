import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { showRiskNoticeDialogBeforeDepositOrWithdraw } from '@onekeyhq/kit/src/views/Earn/components/RiskNoticeDialog';
import { showConfirmDialogAsync } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/showKYCDialog';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import {
  ECheckAmountActionType,
  EEarnLabels,
  type IEarnManagePageResponse,
  type IEarnTokenInfo,
  type IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import {
  useUniversalStake,
  useUniversalWithdraw,
} from '../../../hooks/useUniversalHooks';

import { SpecialManageContent } from './SpecialManageContent';
import { ESpecialManageLayoutType } from './types';

import type { ISpecialManageButtonConfig } from './types';

interface IAdaManageContentProps {
  managePageData?: IEarnManagePageResponse;
  networkId: string;
  symbol: ISupportedSymbol;
  provider: string;
  vault?: string;
  onHistory?: () => void;
  showApyDetail?: boolean;
  isInModalContext?: boolean;
  beforeFooter?: React.ReactElement | null;
  fallbackTokenImageUri?: string;
  earnAccount?: {
    walletId: string;
    accountId: string;
    networkId: string;
    accountAddress: string;
    account: INetworkAccount;
  } | null;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
}

export function AdaManageContent({
  managePageData,
  networkId,
  symbol,
  provider,
  vault,
  onHistory,
  showApyDetail = false,
  isInModalContext = false,
  beforeFooter,
  fallbackTokenImageUri,
  earnAccount,
  protocolInfo,
  tokenInfo,
}: IAdaManageContentProps) {
  const appNavigation = useAppNavigation();
  const [delegateLoading, setDelegateLoading] = useState(false);
  const [undelegateLoading, setUndelegateLoading] = useState(false);

  const holdings = managePageData?.holdings;
  const receiveAction = managePageData?.receive;
  const historyAction = managePageData?.history;
  const delegateAction = managePageData?.delegate;
  const undelegateAction = managePageData?.undelegate;
  const riskNoticeDialog = managePageData?.riskNoticeDialog;

  // Extract the balance amount from holdings.title to use for rewards calculation
  const holdingsAmount = useMemo(
    () => earnUtils.extractAmountFromText(holdings?.title),
    [holdings?.title],
  );

  // Determine which action to use for transaction confirmation
  const actionType = useMemo(() => {
    if (undelegateAction && !undelegateAction.disabled) {
      return ECheckAmountActionType.UNDELEGATE;
    }
    if (delegateAction && !delegateAction.disabled) {
      return ECheckAmountActionType.DELEGATE;
    }
    return undefined;
  }, [delegateAction, undelegateAction]);

  // Fetch transaction confirmation to get rewards information
  const { result: transactionConfirmation } = usePromiseResult(async () => {
    if (!earnAccount?.accountAddress || !holdingsAmount || !actionType) {
      return undefined;
    }

    const amountBN = new BigNumber(holdingsAmount);
    if (amountBN.isNaN() || amountBN.lte(0)) {
      return undefined;
    }

    try {
      const resp =
        await backgroundApiProxy.serviceStaking.getTransactionConfirmation({
          networkId,
          provider,
          symbol,
          vault: vault || '',
          accountAddress: earnAccount.accountAddress,
          action: actionType,
          amount: holdingsAmount,
        });
      return resp;
    } catch (error) {
      console.error('Failed to fetch transaction confirmation:', error);
      return undefined;
    }
  }, [
    earnAccount?.accountAddress,
    networkId,
    symbol,
    provider,
    vault,
    holdingsAmount,
    actionType,
  ]);

  // Convert holdings token to IToken format with fallback
  const token = useMemo(() => {
    if (!holdings?.token) return null;
    return {
      ...holdings.token,
      isNative: false,
    };
  }, [holdings?.token]);

  const handleReceive = useCallback(() => {
    if (!token || !earnAccount) return;

    appNavigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveToken,
      params: {
        networkId,
        accountId: earnAccount.accountId,
        walletId: earnAccount.walletId,
        token,
      },
    });
  }, [appNavigation, networkId, earnAccount, token]);

  const handleStake = useUniversalStake({
    accountId: earnAccount?.accountId || '',
    networkId,
  });

  const handleWithdraw = useUniversalWithdraw({
    accountId: earnAccount?.accountId || '',
    networkId,
  });

  const handleDelegate = useCallback(async () => {
    const executeStake = async () => {
      await handleStake({
        symbol,
        provider,
        amount: '0',
        protocolVault: vault,
        stakingInfo: {
          label: EEarnLabels.Stake,
          protocol: earnUtils.getEarnProviderName({
            providerName: provider,
          }),
          protocolLogoURI: protocolInfo?.providerDetail?.logoURI,
          // ADA delegate doesn't transfer funds, so no send field needed
          tags: protocolInfo?.stakeTag ? [protocolInfo.stakeTag] : [],
        },
      });
    };

    // Show delegate reminder dialog if data is present
    if (delegateAction?.data) {
      const confirmed = await showConfirmDialogAsync({
        data: delegateAction.data,
      });
      if (!confirmed) {
        return;
      }
    }

    setDelegateLoading(true);
    try {
      // Show risk notice if riskNoticeDialog is present
      if (
        earnAccount?.accountAddress &&
        provider &&
        networkId &&
        riskNoticeDialog
      ) {
        showRiskNoticeDialogBeforeDepositOrWithdraw({
          networkId,
          providerName: provider,
          address: earnAccount.accountAddress,
          operationType: 'deposit',
          riskNoticeDialogContent: riskNoticeDialog,
          onConfirm: executeStake,
          onClose: () => setDelegateLoading(false),
        });
      } else {
        await executeStake();
      }
    } finally {
      if (!riskNoticeDialog) {
        setDelegateLoading(false);
      }
    }
  }, [
    symbol,
    provider,
    vault,
    handleStake,
    earnAccount,
    networkId,
    riskNoticeDialog,
    delegateAction,
    protocolInfo,
  ]);

  const handleUndelegate = useCallback(async () => {
    const withdrawToken = tokenInfo?.token as IToken | undefined;
    const executeWithdraw = async () => {
      await handleWithdraw({
        symbol,
        provider,
        amount: holdingsAmount || '0',
        protocolVault: vault,
        withdrawAll: false,
        stakingInfo: {
          label: EEarnLabels.Withdraw,
          protocol: earnUtils.getEarnProviderName({
            providerName: provider,
          }),
          protocolLogoURI: protocolInfo?.providerDetail?.logoURI,
          receive: withdrawToken
            ? { token: withdrawToken, amount: holdingsAmount || '0' }
            : undefined,
          tags: protocolInfo?.stakeTag ? [protocolInfo.stakeTag] : [],
        },
      });
    };

    // Show undelegate reminder dialog if data is present
    if (undelegateAction?.data) {
      const confirmed = await showConfirmDialogAsync({
        data: undelegateAction.data,
      });
      if (!confirmed) {
        return;
      }
    }

    setUndelegateLoading(true);
    try {
      // Show risk notice if riskNoticeDialog is present
      if (
        earnAccount?.accountAddress &&
        provider &&
        networkId &&
        riskNoticeDialog
      ) {
        showRiskNoticeDialogBeforeDepositOrWithdraw({
          networkId,
          providerName: provider,
          address: earnAccount.accountAddress,
          operationType: 'withdraw',
          riskNoticeDialogContent: riskNoticeDialog,
          onConfirm: executeWithdraw,
          onClose: () => setUndelegateLoading(false),
        });
      } else {
        await executeWithdraw();
      }
    } finally {
      if (!riskNoticeDialog) {
        setUndelegateLoading(false);
      }
    }
  }, [
    symbol,
    provider,
    vault,
    holdingsAmount,
    handleWithdraw,
    earnAccount,
    networkId,
    riskNoticeDialog,
    undelegateAction,
    protocolInfo,
    tokenInfo,
  ]);

  // Configure buttons based on available actions
  const buttonConfig = useMemo((): ISpecialManageButtonConfig => {
    // Case 1: Only delegate action (single button)
    if (delegateAction && (!undelegateAction || undelegateAction.disabled)) {
      return {
        type: ESpecialManageLayoutType.Single,
        buttons: {
          primary: {
            text: delegateAction.text?.text || 'Delegate',
            variant: 'primary',
            disabled: !earnAccount?.accountAddress || delegateAction.disabled,
            loading: delegateLoading,
            onPress: handleDelegate,
          },
        },
      };
    }

    // Case 2: Undelegate + Receive (dual buttons)
    if (undelegateAction || receiveAction) {
      return {
        type: ESpecialManageLayoutType.Dual,
        buttons: {
          secondary: undelegateAction
            ? {
                text: undelegateAction.text?.text || 'Undelegate',
                disabled:
                  undelegateAction.disabled || !earnAccount?.accountAddress,
                loading: undelegateLoading,
                onPress: handleUndelegate,
              }
            : undefined,
          primary: receiveAction
            ? {
                text: receiveAction.text?.text || 'Receive',
                variant: 'primary',
                disabled: receiveAction.disabled,
                onPress: handleReceive,
              }
            : undefined,
        },
      };
    }

    // Fallback: empty config
    return {
      type: ESpecialManageLayoutType.Single,
      buttons: {},
    };
  }, [
    delegateAction,
    undelegateAction,
    receiveAction,
    earnAccount?.accountAddress,
    delegateLoading,
    undelegateLoading,
    handleDelegate,
    handleUndelegate,
    handleReceive,
  ]);

  return (
    <SpecialManageContent
      holdings={holdings}
      historyAction={historyAction}
      onHistory={onHistory}
      showApyDetail={showApyDetail}
      isInModalContext={isInModalContext}
      beforeFooter={beforeFooter}
      buttonConfig={buttonConfig}
      transactionConfirmation={transactionConfirmation}
      fallbackTokenImageUri={fallbackTokenImageUri}
      fallbackSymbol={symbol}
    />
  );
}

import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import {
  ECheckAmountActionType,
  type IEarnManagePageResponse,
  type IStakeTag,
} from '@onekeyhq/shared/types/staking';

import { showKYCDialog } from '../../../components/ProtocolDetails/showKYCDialog';
import { useHandleSwap } from '../../../hooks/useHandleSwap';

import { SpecialManageContent } from './SpecialManageContent';
import { ESpecialManageLayoutType } from './types';

import type { ISpecialManageButtonConfig } from './types';

interface IUSDEManageContentProps {
  managePageData?: IEarnManagePageResponse;
  networkId: string;
  symbol: ISupportedSymbol;
  provider: string;
  vault?: string;
  onHistory?: () => void;
  indicatorAccountId?: string;
  stakeTag?: IStakeTag;
  onIndicatorRefresh?: () => void;
  onRefreshPendingRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  showApyDetail?: boolean;
  isInModalContext?: boolean;
  beforeFooter?: React.ReactElement | null;
  fallbackTokenImageUri?: string;
  onActionSuccess?: () => void;
  earnAccount?: {
    walletId: string;
    accountId: string;
    networkId: string;
    accountAddress: string;
    account: INetworkAccount;
  } | null;
}

export function USDEManageContent({
  managePageData,
  networkId,
  symbol,
  provider,
  vault,
  onHistory,
  indicatorAccountId,
  stakeTag,
  onIndicatorRefresh,
  onRefreshPendingRef,
  showApyDetail = false,
  isInModalContext = false,
  beforeFooter,
  fallbackTokenImageUri,
  onActionSuccess,
  earnAccount,
}: IUSDEManageContentProps) {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const { handleSwap } = useHandleSwap();

  const holdings = managePageData?.holdings;
  const receiveAction = managePageData?.receive;
  const tradeAction = managePageData?.trade;
  const historyAction = managePageData?.history;
  const activateAction = managePageData?.activate;

  // Extract the balance amount from holdings.title to use for rewards calculation
  const holdingsAmount = useMemo(
    () => earnUtils.extractAmountFromText(holdings?.title),
    [holdings?.title],
  );

  // Fetch transaction confirmation to get rewards information
  const { result: transactionConfirmation } = usePromiseResult(async () => {
    if (!earnAccount?.accountAddress || !holdingsAmount) {
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
          action: ECheckAmountActionType.STAKING,
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
  ]);

  // TODO: Convert holdings token to IToken format with fallback
  // Should fallback to tokenInfo?.token if holdings?.token is missing
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

  const handleTrade = useCallback(async () => {
    if (!token) return;

    try {
      await handleSwap({
        token,
        networkId,
      });
    } catch (error) {
      console.error('handleTrade error:', error);
    }
  }, [handleSwap, networkId, token]);

  const handleActivate = useCallback(() => {
    if (!activateAction) return;

    showKYCDialog({
      actionData: activateAction,
      onConfirm: async (checkboxStates: boolean[]) => {
        if (checkboxStates.every(Boolean)) {
          const resp =
            await backgroundApiProxy.serviceStaking.verifyRegisterSignMessage({
              networkId,
              provider,
              symbol,
              accountAddress: earnAccount?.accountAddress ?? '',
              signature: '',
              message: '',
            });
          if (resp.toast) {
            Toast.success({
              title: resp.toast.text.text,
            });
          }
          onActionSuccess?.();
        }
      },
    });
  }, [
    activateAction,
    networkId,
    provider,
    symbol,
    earnAccount?.accountAddress,
    onActionSuccess,
  ]);

  // Configure buttons based on available actions
  const buttonConfig = useMemo((): ISpecialManageButtonConfig => {
    // Case 1: Activate action (single button)
    if (activateAction) {
      return {
        type: ESpecialManageLayoutType.Single,
        buttons: {
          primary: {
            text: activateAction.text?.text || 'Activate',
            variant: 'primary',
            disabled: !earnAccount?.accountAddress || activateAction.disabled,
            onPress: handleActivate,
          },
        },
      };
    }

    // Case 2: Receive + Trade (dual buttons)
    if (receiveAction || tradeAction) {
      return {
        type: ESpecialManageLayoutType.Dual,
        buttons: {
          secondary: receiveAction
            ? {
                text: receiveAction.text?.text || 'Receive',
                disabled: receiveAction.disabled,
                onPress: handleReceive,
              }
            : undefined,
          primary: tradeAction
            ? {
                text: tradeAction.text?.text || 'Trade',
                variant: 'primary',
                disabled: tradeAction.disabled,
                onPress: () => void handleTrade(),
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
    activateAction,
    receiveAction,
    tradeAction,
    earnAccount?.accountAddress,
    handleActivate,
    handleReceive,
    handleTrade,
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

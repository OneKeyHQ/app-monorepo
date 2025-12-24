import { memo, useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { flatMap, map } from 'lodash';
import { useIntl } from 'react-intl';

import type { IAlertType } from '@onekeyhq/components';
import { Alert } from '@onekeyhq/components';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useCustomRpcStatusAtom,
  useDecodedTxsAtom,
  useNativeTokenInfoAtom,
  usePayWithTokenInfoAtom,
  usePreCheckTxStatusAtom,
  useSendFeeStatusAtom,
  useSendSelectedFeeInfoAtom,
  useSendTxStatusAtom,
  useSignatureConfirmActions,
  useTronResourceRentalInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { showCustomRpcFallbackDialog } from '@onekeyhq/kit/src/views/Send/components/CustomRpcFallbackDialog';
import type { ITransferPayload } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';

interface IProps {
  accountId: string;
  networkId: string;
  transferPayload?: ITransferPayload;
}

function TxConfirmAlert(props: IProps) {
  const { networkId, accountId, transferPayload } = props;

  const intl = useIntl();
  const navigation = useAppNavigation();
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [sendTxStatus] = useSendTxStatusAtom();
  const [nativeTokenInfo] = useNativeTokenInfoAtom();
  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();
  const [preCheckTxStatus] = usePreCheckTxStatusAtom();
  const { network } = useAccountData({
    networkId,
  });
  const [payWithTokenInfo] = usePayWithTokenInfoAtom();
  const [tronResourceRentalInfo] = useTronResourceRentalInfoAtom();
  const [customRpcStatus] = useCustomRpcStatusAtom();
  const { updateCustomRpcStatus, clearCustomRpcStatus } =
    useSignatureConfirmActions().current;

  const renderDecodedTxsAlert = useCallback(() => {
    const alerts = flatMap(
      map(decodedTxs, (tx) => tx.txDisplay?.alerts),
    ).filter(Boolean);

    return alerts.map((alert) => (
      <Alert
        key={alert}
        description={alert}
        type="warning"
        icon="InfoSquareOutline"
      />
    ));
  }, [decodedTxs]);

  const renderTxFeeAlert = useCallback(() => {
    if (!sendFeeStatus.errMessage) {
      return null;
    }
    return (
      <Alert
        icon="ErrorOutline"
        type="critical"
        title={sendFeeStatus.errMessage}
        action={{
          primary: intl.formatMessage({
            id: ETranslations.global_retry,
          }),
          isPrimaryLoading: sendFeeStatus.status === ESendFeeStatus.Loading,
          onPrimaryPress() {
            appEventBus.emit(EAppEventBusNames.EstimateTxFeeRetry, undefined);
          },
        }}
      />
    );
  }, [intl, sendFeeStatus.errMessage, sendFeeStatus.status]);

  const renderInsufficientNativeBalanceAlert = useCallback(() => {
    if (
      !sendTxStatus.isInsufficientNativeBalance &&
      !sendTxStatus.isInsufficientTokenBalance
    ) {
      return null;
    }

    if (payWithTokenInfo.enabled && sendTxStatus.isInsufficientTokenBalance) {
      return (
        <Alert
          icon="ErrorOutline"
          type="critical"
          title={intl.formatMessage(
            {
              id: ETranslations.msg__str_is_required_for_network_fees_top_up_str_to_make_tx,
            },
            {
              symbol: payWithTokenInfo.symbol ?? '',
              amount: sendTxStatus.fillUpTokenBalance ?? '0',
            },
          )}
        />
      );
    }

    return (
      <Alert
        icon="ErrorOutline"
        type="critical"
        title={`${intl.formatMessage(
          {
            id: ETranslations.msg__str_is_required_for_network_fees_top_up_str_to_make_tx,
          },
          {
            symbol: network?.symbol ?? '',
            amount: sendTxStatus.fillUpNativeBalance ?? '0',
          },
        )}${
          sendTxStatus.isBaseOnEstimateMaxFee
            ? `(${intl.formatMessage(
                {
                  id: ETranslations.insufficient_fee_append_desc,
                },
                {
                  amount: sendTxStatus.maxFeeNative ?? '0',
                  symbol: network?.symbol ?? '',
                },
              )})`
            : ''
        }`}
        action={{
          primary: intl.formatMessage({
            id: ETranslations.global_top_up,
          }),
          onPrimaryPress() {
            navigation.pushModal(EModalRoutes.ReceiveModal, {
              screen: EModalReceiveRoutes.ReceiveSelector,
              params: {
                networkId,
                accountId,
                walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
                token: nativeTokenInfo.info,
                onClose: () => {
                  appEventBus.emit(
                    EAppEventBusNames.RefreshNativeTokenInfo,
                    undefined,
                  );
                },
              },
            });
          },
        }}
      />
    );
  }, [
    sendTxStatus.isInsufficientNativeBalance,
    sendTxStatus.isInsufficientTokenBalance,
    sendTxStatus.fillUpNativeBalance,
    sendTxStatus.isBaseOnEstimateMaxFee,
    sendTxStatus.maxFeeNative,
    sendTxStatus.fillUpTokenBalance,
    payWithTokenInfo.enabled,
    payWithTokenInfo.symbol,
    intl,
    network?.symbol,
    navigation,
    networkId,
    accountId,
    nativeTokenInfo.info,
  ]);

  const renderPreCheckTxAlert = useCallback(() => {
    if (preCheckTxStatus.errorMessage) {
      return (
        <Alert
          icon="ErrorOutline"
          type="critical"
          title={preCheckTxStatus.errorMessage}
        />
      );
    }
    return null;
  }, [preCheckTxStatus]);

  const handleSwitchToOneKeyRpc = useCallback(() => {
    if (!customRpcStatus) return;

    showCustomRpcFallbackDialog({
      title: intl.formatMessage({
        id: ETranslations.transfer_send_onekey_rpc_title,
      }),
      confirmText: intl.formatMessage({
        id: ETranslations.transfer_send_onekey_rpc_button,
      }),
      cancelText: intl.formatMessage({
        id: ETranslations.global_cancel,
      }),
      networkId: customRpcStatus.networkId,
      onSwitchOnce: () => {
        updateCustomRpcStatus({
          ...customRpcStatus,
          isCustomRpcUnavailable: false,
          useDefaultRpcOnce: true,
        });
      },
      onSwitchPermanently: () => {
        clearCustomRpcStatus();
      },
      onCancel: () => {},
    });
  }, [intl, customRpcStatus, updateCustomRpcStatus, clearCustomRpcStatus]);

  const renderCustomRpcUnavailableAlert = useCallback(() => {
    if (
      !customRpcStatus?.isCustomRpcUnavailable ||
      customRpcStatus?.useDefaultRpcOnce
    ) {
      return null;
    }
    return (
      <Alert
        icon="InfoCircleOutline"
        type="critical"
        title={intl.formatMessage({
          id: ETranslations.transfer_custom_rpc_fail_title,
        })}
        description={intl.formatMessage({
          id: ETranslations.transfer_custom_rpc_fail_desc,
        })}
        action={{
          primary: intl.formatMessage({
            id: ETranslations.transfer_custom_rpc_fail_button,
          }),
          onPrimaryPress: handleSwitchToOneKeyRpc,
        }}
      />
    );
  }, [intl, customRpcStatus, handleSwitchToOneKeyRpc]);

  const renderChainSpecialAlert = useCallback(() => {
    if (
      networkId === getNetworkIdsMap().kaspa &&
      accountUtils.isHwAccount({ accountId }) &&
      transferPayload?.tokenInfo &&
      !transferPayload.tokenInfo.isNative
    ) {
      return (
        <Alert
          type="warning"
          title={intl.formatMessage({
            id: ETranslations.sending_krc20_warning_text,
          })}
        />
      );
    }

    if (networkUtils.isTronNetworkByNetworkId(networkId)) {
      const alerts: {
        title: string;
        type: IAlertType;
      }[] = [];
      if (
        tronResourceRentalInfo.isResourceRentalNeeded &&
        tronResourceRentalInfo.isResourceRentalEnabled &&
        (accountUtils.isHwAccount({ accountId }) ||
          accountUtils.isQrAccount({ accountId }))
      ) {
        alerts.push({
          title: intl.formatMessage({
            id: ETranslations.wallet_energy_confirmations_required,
          }),
          type: 'warning',
        });
      }

      if (transferPayload?.isTronResourceAutoClaimed) {
        alerts.push({
          title: intl.formatMessage({
            id: new BigNumber(sendSelectedFeeInfo?.totalNative ?? '0').isZero()
              ? ETranslations.wallet_banner_send_free
              : ETranslations.wallet_banner_discounted_send,
          }),
          type: 'info',
        });
      }

      return (
        <>
          {alerts.map((alert, index) => (
            <Alert key={index} type={alert.type} title={alert.title} />
          ))}
        </>
      );
    }

    return null;
  }, [
    accountId,
    intl,
    networkId,
    sendSelectedFeeInfo?.totalNative,
    transferPayload?.isTronResourceAutoClaimed,
    transferPayload?.tokenInfo,
    tronResourceRentalInfo.isResourceRentalEnabled,
    tronResourceRentalInfo.isResourceRentalNeeded,
  ]);

  return (
    <>
      {renderCustomRpcUnavailableAlert()}
      {renderTxFeeAlert()}
      {renderInsufficientNativeBalanceAlert()}
      {renderDecodedTxsAlert()}
      {renderPreCheckTxAlert()}
      {renderChainSpecialAlert()}
    </>
  );
}

export default memo(TxConfirmAlert);

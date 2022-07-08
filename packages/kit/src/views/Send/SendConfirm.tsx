import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  IDecodedTxActionType,
  IEncodedTx,
  ISignedTx,
} from '@onekeyhq/engine/src/vaults/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useManageTokens } from '../../hooks';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import { useDecodedTx } from '../../hooks/useDecodedTx';
import { useDisableNavigationAnimation } from '../../hooks/useDisableNavigationAnimation';
import { useOnboardingFinished } from '../../hooks/useOnboardingFinished';
import { wait } from '../../utils/helper';
import { TxDetailView } from '../TxDetail/TxDetailView';

import { FeeInfoInputForConfirmLite } from './FeeInfoInput';
import SendConfirmLegacy from './SendConfirmLegacy';
import { SendConfirmLoading } from './SendConfirmViews/SendConfirmLoading';
import {
  ITxConfirmViewProps,
  ITxConfirmViewPropsHandleConfirm,
  SendConfirmModal,
} from './SendConfirmViews/SendConfirmModal';
import { SendConfirmSpeedUpOrCancel } from './SendConfirmViews/SendConfirmSpeedUpOrCancel';
import { SendConfirmTransfer } from './SendConfirmViews/SendConfirmTransfer';
import {
  SendAuthenticationParams,
  SendConfirmParams,
  SendRoutes,
} from './types';
import {
  FEE_INFO_POLLING_INTERVAL,
  useFeeInfoPayload,
} from './useFeeInfoPayload';
import { useSendConfirmRouteParamsParsed } from './useSendConfirmRouteParamsParsed';

function useReloadAccountBalance() {
  // do not remove this line, call account balance fetch
  useManageTokens({
    fetchTokensOnMount: true,
  });
}

// remove gas price if encodedTx build by DAPP
function removeFeeInfoInTx(encodedTx: IEncodedTxEvm) {
  // *** DO NOT delete gasLimit here, fetchFeeInfo() will use it to calculate max limit
  // delete encodedTx.gas;
  // delete encodedTx.gasLimit;

  // *** DELETE gasPrice and use wallet re-calculated fee price
  delete encodedTx.gasPrice;
  delete encodedTx.maxPriorityFeePerGas;
  delete encodedTx.maxFeePerGas;

  return encodedTx;
}

// TODO move to Vault / Service
async function prepareSendConfirmEncodedTx({
  encodedTx,
  networkImpl,
  sendConfirmParams,
  address,
}: {
  encodedTx?: IEncodedTx;
  networkImpl: string;
  sendConfirmParams: SendConfirmParams;
  address: string;
}): Promise<IEncodedTx> {
  if (!encodedTx) {
    throw new Error('prepareEncodedTx encodedTx should NOT be null');
  }
  if (networkImpl === IMPL_EVM) {
    const encodedTxEvm = encodedTx as IEncodedTxEvm;
    // routeParams is not editable, so should create new one
    let tx = { ...encodedTxEvm };
    tx.from = address || tx.from;
    // remove gas price if encodedTx build by DAPP
    if (sendConfirmParams.sourceInfo) {
      tx = removeFeeInfoInTx(tx);
    }
    return Promise.resolve(tx);
  }
  return Promise.resolve(encodedTx);
}

function useSendConfirmEncodedTx({
  sendConfirmParams,
  networkImpl,
  address,
}: {
  networkImpl: string;
  sendConfirmParams: SendConfirmParams; // routeParams
  address: string;
}): { encodedTx: IEncodedTx | null } {
  const [encodedTx, setEncodedTx] = useState<IEncodedTx | null>(null);
  useEffect(() => {
    // remove gas price if need
    prepareSendConfirmEncodedTx({
      encodedTx: sendConfirmParams.encodedTx,
      sendConfirmParams,
      networkImpl,
      address,
    }).then(setEncodedTx);
  }, [address, networkImpl, sendConfirmParams, sendConfirmParams.encodedTx]);
  return { encodedTx };
}

function SendConfirm() {
  useOnboardingFinished();
  useReloadAccountBalance();
  const { engine, serviceHistory, serviceToken } = backgroundApiProxy;
  const { accountId, networkId, walletId, networkImpl, account } =
    useActiveWalletAccount();

  const {
    navigation,
    routeParams,
    feeInfoEditable,
    feeInfoUseFeeInTx,
    sourceInfo,
    payload,
    payloadInfo,
    resendActionInfo,
    isSpeedUpOrCancel,
    isFromDapp,
  } = useSendConfirmRouteParamsParsed();

  useDisableNavigationAnimation({
    condition: !!routeParams.autoConfirmAfterFeeSaved,
  });

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeOnError: true,
  });

  const { encodedTx } = useSendConfirmEncodedTx({
    sendConfirmParams: routeParams,
    networkImpl,
    address: account?.address || '',
  });

  const { decodedTx } = useDecodedTx({
    encodedTx,
    payload: payloadInfo || payload,
    sourceInfo,
  });

  const isInternalNativeTransferType = useMemo(() => {
    // TODO also check payloadInfo.type===NativeTransfer
    if (isFromDapp || !payload) {
      return false;
    }
    if (decodedTx && decodedTx?.actions?.length === 1) {
      const action = decodedTx.actions[0];
      if (action.type === IDecodedTxActionType.NATIVE_TRANSFER) {
        return true;
      }
    }
    return false;
  }, [decodedTx, isFromDapp, payload]);

  const { feeInfoPayload, feeInfoLoading } = useFeeInfoPayload({
    encodedTx,
    useFeeInTx: feeInfoUseFeeInTx,
    pollingInterval: feeInfoEditable ? FEE_INFO_POLLING_INTERVAL : 0,
  });

  const handleConfirm = useCallback<ITxConfirmViewPropsHandleConfirm>(
    // eslint-disable-next-line @typescript-eslint/no-shadow
    async ({ close, encodedTx }) => {
      if (!encodedTx) {
        return;
      }
      let encodedTxWithFee = encodedTx;
      if (feeInfoEditable && feeInfoPayload) {
        encodedTxWithFee = await engine.attachFeeInfoToEncodedTx({
          networkId,
          accountId,
          encodedTx,
          feeInfoValue: feeInfoPayload?.current.value,
        });
      }
      const onSuccess: SendAuthenticationParams['onSuccess'] = async (
        tx: ISignedTx,
        data,
      ) => {
        // refresh balance
        serviceToken.fetchAccountTokens({
          activeAccountId: accountId,
          activeNetworkId: networkId,
          withBalance: true,
          withPrice: false,
        });
        await dappApprove.resolve({
          result: tx.txid,
        });
        await serviceHistory.saveSendConfirmHistory({
          networkId,
          accountId,
          data,
          resendActionInfo,
        });
        if (routeParams.onSuccess) {
          routeParams.onSuccess(tx, data);
        }
        await serviceHistory.refreshHistoryUi();

        // openBlockBrowser
        // openTransactionDetails(tx.txid);

        setTimeout(() => close(), 0);
      };
      const nextRouteParams: SendAuthenticationParams = {
        ...routeParams,
        encodedTx: encodedTxWithFee,
        accountId,
        walletId,
        networkId,
        onSuccess,
      };
      let nextRouteAction: 'replace' | 'navigate' = 'navigate';
      if (routeParams.autoConfirmAfterFeeSaved) {
        // add delay to avoid white screen when navigation replace
        await wait(600);
        nextRouteAction = 'replace';
      }
      return navigation[nextRouteAction](
        SendRoutes.SendAuthentication,
        nextRouteParams,
      );
    },
    [
      accountId,
      dappApprove,
      engine,
      feeInfoEditable,
      feeInfoPayload,
      navigation,
      networkId,
      resendActionInfo,
      routeParams,
      serviceHistory,
      serviceToken,
      walletId,
    ],
  );

  const feeInput = (
    <FeeInfoInputForConfirmLite
      sendConfirmParams={routeParams}
      editable={feeInfoEditable}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={feeInfoLoading}
    />
  );
  const sharedProps: ITxConfirmViewProps = {
    sendConfirmParams: routeParams,

    sourceInfo,
    encodedTx,
    decodedTx,
    payload,

    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    feeInput,

    handleConfirm,
    onSecondaryActionPress: ({ close }) => {
      dappApprove.reject();
      close();
    },
    onModalClose: dappApprove.reject,
    children: null,
  };

  // waiting for tx decode
  const isWaitingTxReady = !decodedTx || !encodedTx;
  if (isWaitingTxReady) {
    return <SendConfirmLoading {...sharedProps} />;
  }
  sharedProps.children = (
    <>
      <TxDetailView isSendConfirm decodedTx={decodedTx} feeInput={feeInput} />
    </>
  );

  if (isSpeedUpOrCancel) {
    return <SendConfirmSpeedUpOrCancel {...sharedProps} />;
  }

  // handle Max Native Transfer
  if (isInternalNativeTransferType) {
    return <SendConfirmTransfer {...sharedProps} />;
  }

  // internal transfer type, max send

  // handle speed up / cancel.

  // token approve

  // internal swap

  // TODO payload type check, SendConfirmTransfer

  // blind sign and send

  return <SendConfirmModal {...sharedProps} />;
}

function SendConfirmProxy() {
  return platformEnv.isLegacySendConfirm ? (
    <SendConfirmLegacy />
  ) : (
    <SendConfirm />
  );
}

// export default SendConfirm;
export default SendConfirmProxy;
export { SendConfirm };

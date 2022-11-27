import React, { useCallback } from 'react';

import { isEmpty, map } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, GroupingList, ListItem } from '@onekeyhq/components';
import { IDecodedTx, ISignedTx } from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useWalletConnectPrepareConnection } from '../../../../components/WalletConnect/useWalletConnectPrepareConnection';
import { useActiveSideAccount } from '../../../../hooks';
import { useDisableNavigationAnimation } from '../../../../hooks/useDisableNavigationAnimation';
import { useOnboardingRequired } from '../../../../hooks/useOnboardingRequired';
import { wait } from '../../../../utils/helper';
import { BatchTxsItemView } from '../../../TxDetail/BatchTxsItemView';
import { BatchSendConfirmModalBase } from '../../components/BatchSendConfirmModalBase';
import { BatchTransactionFeeInfo } from '../../components/BatchTransactionFeeInfo';
import {
  BatchSendProgressParams,
  IBatchTxsConfirmViewProps,
  IBatchTxsConfirmViewPropsHandleConfirm,
  SendFeedbackReceiptParams,
  SendRoutes,
} from '../../types';
import { useBatchSendConfirmDecodedTxs } from '../../utils/useBatchSendConfirmDecodedTxs';
import { useBatchSendConfirmEncodedTxs } from '../../utils/useBatchSendConfirmEncodedTxs';
import {
  FEE_INFO_POLLING_INTERVAL,
  useBatchSendConfirmFeeInfoPayload,
} from '../../utils/useBatchSendConfirmFeeInfoPayload';
import { useBatchSendConfirmRouteParamsParsed } from '../../utils/useBatchSendConfirmRouteParamsParsed';
import { useReloadAccountBalance } from '../../utils/useReloadAccountBalance';

import { BatchSendConfirmLoading } from './BatchSendConfirmLoading';

interface Props {
  batchSendConfirmParamsParsed: ReturnType<
    typeof useBatchSendConfirmRouteParamsParsed
  >;
}

function BatchSendConfirm({ batchSendConfirmParamsParsed }: Props) {
  const {
    navigation,
    routeParams,
    sourceInfo,
    payload,
    payloadInfo,
    isFromDapp,
    dappApprove,
    onModalClose,
    networkId,
    accountId,
    feeInfoUseFeeInTx,
    feeInfoEditable,
  } = batchSendConfirmParamsParsed;
  const intl = useIntl();
  useOnboardingRequired();
  useReloadAccountBalance({ networkId, accountId });
  useDisableNavigationAnimation({
    condition: !!routeParams.autoConfirmAfterFeeSaved,
  });
  const { engine, serviceHistory, serviceToken } = backgroundApiProxy;

  const { networkImpl, accountAddress, walletId } = useActiveSideAccount({
    accountId,
    networkId,
  });

  const { encodedTxs } = useBatchSendConfirmEncodedTxs({
    batchSendConfirmParams: routeParams,
    networkImpl,
    address: accountAddress || '',
  });
  const encodedTx = encodedTxs[0];
  const isSingleTransformMode = encodedTxs.length === 1;

  const { decodedTxs } = useBatchSendConfirmDecodedTxs({
    accountId,
    networkId,
    encodedTxs,
    payload: payloadInfo,
    sourceInfo,
  });
  const decodedTx = decodedTxs[0];

  const { feeInfoPayloads, feeInfoLoading, totalFeeInNative } =
    useBatchSendConfirmFeeInfoPayload({
      accountId,
      networkId,
      encodedTxs,
      decodedTxs,
      useFeeInTx: feeInfoUseFeeInTx,
      pollingInterval: feeInfoEditable ? FEE_INFO_POLLING_INTERVAL : 0,
      signOnly: routeParams.signOnly,
      forBatchSend: true,
    });
  useWalletConnectPrepareConnection({
    accountId,
    networkId,
  });
  const handleConfirm = useCallback<IBatchTxsConfirmViewPropsHandleConfirm>(
    // eslint-disable-next-line @typescript-eslint/no-shadow
    async ({ close, encodedTxs }) => {
      if (isEmpty(encodedTxs)) {
        return;
      }
      let encodedTxsWithFee = encodedTxs;
      if (feeInfoEditable && !isEmpty(feeInfoPayloads)) {
        encodedTxsWithFee = await Promise.all(
          encodedTxs.map((tx, index) =>
            engine.attachFeeInfoToEncodedTx({
              networkId,
              accountId,
              encodedTx: tx,
              feeInfoValue: feeInfoPayloads[index]?.current.value,
            }),
          ),
        );
      }

      const onFail = (error: Error) => {
        dappApprove.reject({
          error,
        });
      };

      const onSuccess: BatchSendProgressParams['onSuccess'] = async (
        txs: ISignedTx[],
        data,
      ) => {
        serviceToken.fetchAccountTokens({
          activeAccountId: accountId,
          activeNetworkId: networkId,
          withBalance: true,
          withPrice: false,
        });

        if (routeParams.signOnly) {
          await dappApprove.resolve({ result: map(txs, 'rawTx') });
        } else {
          await dappApprove.resolve({
            result: map(txs, 'txid'),
          });
          await Promise.all(
            txs.map((_, index) =>
              serviceHistory.saveSendConfirmHistory({
                networkId,
                accountId,
                data: {
                  signedTx: data?.signedTxs && data?.signedTxs[index],
                  encodedTx: data?.encodedTxs && data?.encodedTxs[index],
                  decodedTx: data?.decodedTxs && data?.decodedTxs[index],
                },
                feeInfo: feeInfoPayloads[index]?.current.value,
              }),
            ),
          );
        }

        const type = routeParams.signOnly ? 'Sign' : 'Send';
        const params: SendFeedbackReceiptParams = {
          networkId,
          accountId,
          txid: txs[0].txid ?? 'unknown_txid',
          type,
          closeModal: close,
          onDetail: routeParams.onDetail,
          isSingleTransformMode,
        };
        navigation.navigate(SendRoutes.SendFeedbackReceipt, params);

        if (routeParams.onSuccess) {
          routeParams.onSuccess(txs, data);
        }
        serviceHistory.refreshHistoryUi();

        // navigate SendFeedbackReceipt onSuccess
        // close modal
        setTimeout(() => {
          // close()
        }, 0);
      };

      const nextRouteParams: BatchSendProgressParams = {
        ...routeParams,
        encodedTxs: encodedTxsWithFee,
        accountId,
        networkId,
        walletId,
        onSuccess,
        onFail,
        onModalClose,
      };

      // @ts-ignore
      delete nextRouteParams._disabledAnimationOfNavigate;
      let nextRouteAction: 'replace' | 'navigate' = 'navigate';
      if (routeParams.autoConfirmAfterFeeSaved) {
        // add delay to avoid white screen when navigation replace
        await wait(600);
        nextRouteAction = 'replace';
      }
      return navigation[nextRouteAction](
        SendRoutes.BatchSendProgress,
        nextRouteParams,
      );
    },
    [
      accountId,
      dappApprove,
      engine,
      feeInfoEditable,
      feeInfoPayloads,
      isSingleTransformMode,
      navigation,
      networkId,
      onModalClose,
      routeParams,
      serviceHistory,
      serviceToken,
      walletId,
    ],
  );

  const feeInput = (
    <BatchTransactionFeeInfo
      accountId={accountId}
      networkId={networkId}
      encodedTxs={encodedTxs}
      feeInfoPayloads={feeInfoPayloads}
      feeInfoLoading={feeInfoLoading}
      totalFeeInNative={totalFeeInNative}
      batchSendConfirmParams={routeParams}
      editable={feeInfoEditable}
      isSingleTransformMode={isSingleTransformMode}
    />
  );

  const sharedProps: IBatchTxsConfirmViewProps = {
    accountId,
    networkId,

    batchSendConfirmParams: routeParams,

    sourceInfo,
    encodedTxs,
    decodedTxs,
    payload,

    feeInfoPayloads,
    feeInfoLoading,
    feeInfoEditable,
    totalFeeInNative,
    feeInput,
    isSingleTransformMode,

    handleConfirm,
    onSecondaryActionPress: ({ close }) => {
      dappApprove.reject();
      close();
    },
    // reject with window.close in ext standalone window after modal closed
    onModalClose,
    children: null,
  };

  const groupTransactionsData = decodedTxs.map((tx, index) => ({
    headerProps: {
      title: `${intl.formatMessage({ id: 'form__transaction' })} #${
        index + 1
      }`.toUpperCase(),
    },
    data: [tx],
  }));

  sharedProps.children = isSingleTransformMode ? (
    <BatchTxsItemView
      isSendConfirm
      isSingleTransformMode={isSingleTransformMode}
      decodedTx={decodedTx}
    />
  ) : (
    <GroupingList
      headerProps={{
        title: `${intl.formatMessage({ id: 'form__multiple_transactions' })} (${
          encodedTxs.length
        })`,
      }}
      sections={groupTransactionsData}
      renderItem={({ item }: { item: IDecodedTx }) => (
        <ListItem key={item.txid}>
          <BatchTxsItemView
            isSendConfirm
            isSingleTransformMode={isSingleTransformMode}
            decodedTx={item}
          />
        </ListItem>
      )}
    />
  );

  const isWaitingTxReady = !decodedTx || !encodedTx;
  if (isWaitingTxReady) {
    return <BatchSendConfirmLoading {...sharedProps} />;
  }

  return <BatchSendConfirmModalBase {...sharedProps} />;
}

export { BatchSendConfirm };

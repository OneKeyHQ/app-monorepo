import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty, map } from 'lodash';
import { useIntl } from 'react-intl';

import { GroupingList, ListItem, Text } from '@onekeyhq/components';
import type {
  IDecodedTx,
  ISignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useWalletConnectPrepareConnection } from '../../../../components/WalletConnect/useWalletConnectPrepareConnection';
import { useActiveSideAccount } from '../../../../hooks';
import { useDisableNavigationAnimation } from '../../../../hooks/useDisableNavigationAnimation';
import { useOnboardingRequired } from '../../../../hooks/useOnboardingRequired';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { BulkSenderTypeEnum } from '../../../BulkSender/types';
import { BatchTxsItemView } from '../../../TxDetail/BatchTxsItemView';
import { BatchSendConfirmModalBase } from '../../components/BatchSendConfirmModalBase';
import { BatchSendTokenInfo } from '../../components/BatchSendTokenInfo';
import { BatchTransactionFeeInfo } from '../../components/BatchTransactionFeeInfo';
import { MAX_TRANSACTIONS_DISPLAY_IN_CONFIRM } from '../../constants';
import { SendModalRoutes } from '../../types';
import { useBatchSendConfirmDecodedTxs } from '../../utils/useBatchSendConfirmDecodedTxs';
import { useBatchSendConfirmEncodedTxs } from '../../utils/useBatchSendConfirmEncodedTxs';
import {
  FEE_INFO_POLLING_INTERVAL,
  useBatchSendConfirmFeeInfoPayload,
} from '../../utils/useBatchSendConfirmFeeInfoPayload';
import { useReloadAccountBalance } from '../../utils/useReloadAccountBalance';

import type {
  BatchSendProgressParams,
  IBatchTxsConfirmViewProps,
  IBatchTxsConfirmViewPropsHandleConfirm,
  SendFeedbackReceiptParams,
} from '../../types';
import type { useBatchSendConfirmRouteParamsParsed } from '../../utils/useBatchSendConfirmRouteParamsParsed';

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
    dappApprove,
    onModalClose,
    networkId,
    accountId,
    feeInfoUseFeeInTx,
    feeInfoEditable,
    transferCount,
    transferType,
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
  const transactionCount = decodedTxs.length;

  const {
    feeInfoError,
    feeInfoPayloads,
    feeInfoLoading,
    totalFeeInNative,
    minTotalFeeInNative,
  } = useBatchSendConfirmFeeInfoPayload({
    accountId,
    networkId,
    encodedTxs,
    decodedTxs,
    useFeeInTx: feeInfoUseFeeInTx,
    pollingInterval: feeInfoEditable ? FEE_INFO_POLLING_INTERVAL : 0,
    signOnly: routeParams.signOnly,
    forBatchSend: true,
    transferCount,
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
        txs: ISignedTxPro[],
        data,
      ) => {
        serviceToken.fetchAccountTokens({
          accountId,
          networkId,
        });

        if (routeParams.signOnly) {
          await dappApprove.resolve({ result: map(txs, 'rawTx') });
        } else {
          await dappApprove.resolve({
            result: map(txs, 'txid'),
          });
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

        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendModalRoutes.SendFeedbackReceipt,
            params,
          },
        });

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
        feeInfoPayloads,
        accountId,
        networkId,
        walletId,
        onSuccess,
        onFail,
        onModalClose,
      };

      return navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendModalRoutes.BatchSendProgress,
          params: nextRouteParams,
        },
      });
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
      minTotalFeeInNative={minTotalFeeInNative}
      batchSendConfirmParams={routeParams}
      editable={feeInfoEditable}
      isSingleTransformMode={isSingleTransformMode}
      feeInfoError={feeInfoError}
    />
  );

  const isWaitingTxReady = !decodedTx || !encodedTx;

  const tokenTransferInfo =
    transferType === BulkSenderTypeEnum.NativeToken ||
    transferType === BulkSenderTypeEnum.Token ? (
      <BatchSendTokenInfo
        accountId={accountId}
        networkId={networkId}
        type={transferType}
        payloadInfo={payloadInfo}
      />
    ) : null;

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
    tokenTransferInfo,
    isWaitingTxReady,
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

  const getGroupTransactionsData = useCallback(() => {
    const groupTransactionsData = [];
    for (
      let i = 0,
        len = BigNumber.min(
          transactionCount,
          MAX_TRANSACTIONS_DISPLAY_IN_CONFIRM,
        ).toNumber();
      i < len;
      i += 1
    ) {
      groupTransactionsData.push({
        headerProps: {
          title: `${intl.formatMessage({ id: 'form__transaction' })} #${
            i + 1
          }`.toUpperCase(),
        },
        data: [decodedTxs[i]],
      });
    }

    return groupTransactionsData;
  }, [decodedTxs, intl, transactionCount]);

  sharedProps.children = isSingleTransformMode ? (
    <BatchTxsItemView
      isSendConfirm
      isSingleTransformMode={isSingleTransformMode}
      decodedTx={decodedTx}
    />
  ) : (
    <>
      <GroupingList
        headerProps={{
          title: `${intl.formatMessage({
            id: 'form__multiple_transactions',
          })} (${encodedTxs.length})`,
        }}
        sections={getGroupTransactionsData()}
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
      {transactionCount > MAX_TRANSACTIONS_DISPLAY_IN_CONFIRM && (
        <Text
          typography="Body1Strong"
          color="text-subdued"
          textAlign="center"
          paddingY={4}
        >
          {intl.formatMessage(
            { id: 'action__str_more_transations' },
            { count: transactionCount - MAX_TRANSACTIONS_DISPLAY_IN_CONFIRM },
          )}
        </Text>
      )}
    </>
  );

  return <BatchSendConfirmModalBase {...sharedProps} />;
}

export { BatchSendConfirm };

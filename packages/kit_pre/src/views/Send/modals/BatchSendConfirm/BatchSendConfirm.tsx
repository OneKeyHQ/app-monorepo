import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isEmpty, isNil, map } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  GroupingList,
  HStack,
  ListItem,
  Text,
} from '@onekeyhq/components';
import { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';
import {
  type IDecodedTx,
  type IEncodedTxUpdatePayloadTransfer,
  IEncodedTxUpdateType,
  type ISignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useWalletConnectPrepareConnection } from '../../../../components/WalletConnect/useWalletConnectPrepareConnection';
import { useActiveSideAccount } from '../../../../hooks';
import { useDisableNavigationAnimation } from '../../../../hooks/useDisableNavigationAnimation';
import { useOnboardingRequired } from '../../../../hooks/useOnboardingRequired';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { AmountTypeEnum } from '../../../BulkSender/types';
import { TxDetailView } from '../../../TxDetail/TxDetailView';
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
import { getTransferAmountToUpdate } from '../../utils/useTransferAmountToUpdate';

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
    feeInfoReuseable,
    transferCount,
  } = batchSendConfirmParamsParsed;

  const { bulkType, amountType } = routeParams;
  const tokenInfo = payloadInfo?.tokenInfo;
  const transferInfos = payloadInfo?.transferInfos;

  const intl = useIntl();
  useOnboardingRequired();
  useReloadAccountBalance({ networkId, accountId });
  useDisableNavigationAnimation({
    condition: !!routeParams.autoConfirmAfterFeeSaved,
  });
  const { engine, serviceHistory, serviceToken } = backgroundApiProxy;

  const { networkImpl, accountAddress, walletId, network } =
    useActiveSideAccount({
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
    feeInfoReuseable,
    signOnly: routeParams.signOnly,
    forBatchSend: true,
    transferCount,
    isBtcForkChain: network?.settings.isBtcForkChain,
  });
  useWalletConnectPrepareConnection({
    accountId,
    networkId,
  });

  const isManyToN = useMemo(
    () =>
      bulkType === BulkTypeEnum.ManyToMany ||
      bulkType === BulkTypeEnum.ManyToOne,
    [bulkType],
  );

  const isNativeMaxSend = useMemo(
    () => tokenInfo?.isNative && amountType === AmountTypeEnum.All && isManyToN,
    [amountType, isManyToN, tokenInfo?.isNative],
  );

  const transfersAmountToUpdate = useMemo(
    () =>
      decodedTxs.map((tx, index) => {
        if (!transferInfos) return '0';
        if (isNativeMaxSend) {
          return getTransferAmountToUpdate({
            decodedTx: tx,
            balance: transferInfos[index].amount,
            amount: transferInfos[index].amount,
            totalNativeGasFee: feeInfoPayloads[index]?.current.totalNative,
          });
        }
        return transferInfos[index]?.amount ?? '0';
      }),
    [decodedTxs, feeInfoPayloads, isNativeMaxSend, transferInfos],
  );

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
        const { isAborted, senderAccounts = [], signedTxs = [] } = data ?? {};

        if (isManyToN) {
          serviceToken.batchFetchAccountBalances({
            networkId,
            walletId,
            accountIds: senderAccounts
              .slice(0, signedTxs.length)
              .map((item) => item.accountId),
          });
          serviceToken.batchFetchAccountTokenBalances({
            networkId,
            walletId,
            accountIds: senderAccounts
              .slice(0, signedTxs.length)
              .map((item) => item.accountId),
            tokenAddress: tokenInfo?.tokenIdOnNetwork,
          });
        } else {
          serviceToken.fetchAccountTokens({
            accountId,
            networkId,
          });
        }

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

        if (!isAborted) {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Send,
            params: {
              screen: SendModalRoutes.SendFeedbackReceipt,
              params,
            },
          });
        }

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
      isManyToN,
      isSingleTransformMode,
      navigation,
      networkId,
      onModalClose,
      routeParams,
      serviceHistory,
      serviceToken,
      tokenInfo?.tokenIdOnNetwork,
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

  const tokenTransferInfo = (
    <BatchSendTokenInfo
      accountId={accountId}
      networkId={networkId}
      payloadInfo={payloadInfo}
      bulkType={bulkType}
      amountType={amountType}
      feeInfoPayloads={feeInfoPayloads}
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
          title: (
            <HStack space="10px" alignItems="center">
              <Text
                typography="Subheading"
                color="text-subdued"
                height="14px"
                letterSpacing={0}
              >
                {`${intl.formatMessage({ id: 'form__transaction' })} #${i + 1}
                `.toUpperCase()}
              </Text>
              {isNil(transferInfos?.[i]?.txInterval) ? null : (
                <Badge
                  size="sm"
                  margin={0}
                  title={
                    transferInfos?.[i].txInterval
                      ? intl.formatMessage(
                          { id: 'form__delay_str' },
                          {
                            duration: `${
                              transferInfos?.[i].txInterval as string
                            }s`,
                          },
                        )
                      : ''
                  }
                />
              )}
            </HStack>
          ),
        },
        data: [
          {
            decodedTx: decodedTxs[i],
            transferAmountToUpdate: transfersAmountToUpdate[i],
          },
        ],
      });
    }

    return groupTransactionsData;
  }, [
    decodedTxs,
    intl,
    transactionCount,
    transferInfos,
    transfersAmountToUpdate,
  ]);

  sharedProps.children = isSingleTransformMode ? (
    <TxDetailView
      isSendConfirm
      isBatchSendConfirm
      isSingleTransformMode={isSingleTransformMode}
      decodedTx={decodedTx}
      transferAmount={isNativeMaxSend ? transfersAmountToUpdate[0] : undefined}
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
        renderItem={({
          item,
        }: {
          item: {
            decodedTx: IDecodedTx;
            transferAmountToUpdate: string;
          };
        }) => (
          <ListItem key={item.decodedTx.txid}>
            <TxDetailView
              isSendConfirm
              isBatchSendConfirm
              isSingleTransformMode={isSingleTransformMode}
              decodedTx={item.decodedTx}
              transferAmount={item.transferAmountToUpdate}
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

  return (
    <BatchSendConfirmModalBase
      updateEncodedTxsBeforeConfirm={async (txs) => {
        if (!!transferInfos && isNativeMaxSend) {
          return Promise.all(
            txs.map((tx, index) =>
              (async () => {
                const updatePayload: IEncodedTxUpdatePayloadTransfer = {
                  amount: transfersAmountToUpdate[index],
                  totalBalance: transferInfos[index]?.amount,
                  feeInfo: feeInfoPayloads[index]?.info,
                };
                const newTx = await backgroundApiProxy.engine.updateEncodedTx({
                  networkId,
                  accountId,
                  encodedTx: tx,
                  payload: updatePayload,
                  options: {
                    type: IEncodedTxUpdateType.transfer,
                  },
                });
                return Promise.resolve(newTx);
              })(),
            ),
          );
        }
        return Promise.resolve(txs);
      }}
      {...sharedProps}
    />
  );
}

export { BatchSendConfirm };

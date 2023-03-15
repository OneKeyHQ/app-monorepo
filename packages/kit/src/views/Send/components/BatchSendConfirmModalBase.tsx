import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { toLower } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Center,
  HStack,
  Spinner,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { IDecodedTx } from '@onekeyhq/engine/src/vaults/types';
import { IDecodedTxActionType } from '@onekeyhq/engine/src/vaults/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { isWatchingAccount } from '@onekeyhq/shared/src/engine/engineUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveSideAccount } from '../../../hooks';
import {
  useNativeToken,
  useTokenBalanceWithoutFrozen,
} from '../../../hooks/useTokens';

import { BaseSendModal } from './BaseSendModal';
import { SendConfirmErrorBoundary } from './SendConfirmErrorBoundary';
import { SendConfirmErrorsAlert } from './SendConfirmErrorsAlert';

import type { IBatchTxsConfirmViewProps } from '../types';

function BatchSendConfirmModalBase(props: IBatchTxsConfirmViewProps) {
  const {
    children,
    encodedTxs,
    decodedTxs,
    confirmDisabled,
    feeInfoPayloads,
    feeInfoLoading,
    totalFeeInNative,
    handleConfirm,
    updateEncodedTxsBeforeConfirm,
    autoConfirm,
    sourceInfo,
    feeInput,
    tokenTransferInfo,
    isWaitingTxReady,
    isSingleTransformMode,
    ...others
  } = props;

  const encodedTx = encodedTxs[0];
  const decodedTx = decodedTxs[0];
  const feeInfoPayload = feeInfoPayloads[0];

  const intl = useIntl();
  const isVertical = useIsVerticalLayout();

  const { networkImpl, networkId, accountId, accountAddress } =
    useActiveSideAccount(props);

  const nativeToken = useNativeToken(networkId);

  const nativeBalance = useTokenBalanceWithoutFrozen({
    networkId,
    accountId,
    token: nativeToken,
    fallback: '0',
  });

  const balanceInsufficient = useMemo(() => {
    let nativeBalanceTransferBN = new BigNumber(0);
    for (const tx of decodedTxs) {
      for (const action of (tx as IDecodedTx).actions) {
        if (action.type === IDecodedTxActionType.NATIVE_TRANSFER) {
          nativeBalanceTransferBN = nativeBalanceTransferBN.plus(
            action.nativeTransfer?.amount ?? 0,
          );
        }
      }
    }

    return new BigNumber(nativeBalance ?? '0').lt(
      nativeBalanceTransferBN.plus(totalFeeInNative),
    );
  }, [totalFeeInNative, nativeBalance, decodedTxs]);

  const isWatching = useMemo(
    () => isWatchingAccount({ accountId }),
    [accountId],
  );

  const isAccountNotMatched = useMemo(() => {
    if (!encodedTx) {
      return false;
    }
    if (networkImpl === IMPL_EVM) {
      const tx = encodedTx as IEncodedTxEvm | undefined;
      if (
        tx &&
        accountAddress &&
        toLower(tx.from) !== toLower(accountAddress)
      ) {
        return true;
      }
    }
    return false;
  }, [accountAddress, encodedTx, networkImpl]);

  const confirmAction = useCallback(
    async ({ close, onClose }) => {
      let txs = encodedTxs;
      if (!txs) {
        return;
      }
      if (updateEncodedTxsBeforeConfirm) {
        txs = await updateEncodedTxsBeforeConfirm(txs);
      }
      handleConfirm({ close, onClose, encodedTxs: txs });
    },
    [encodedTxs, handleConfirm, updateEncodedTxsBeforeConfirm],
  );

  const transactionInfoView = (
    <>
      {!autoConfirm && (
        <SendConfirmErrorsAlert
          nativeToken={nativeToken}
          isWatchingAccount={isWatching}
          balanceInsufficient={balanceInsufficient}
          isAccountNotMatched={isAccountNotMatched}
        />
      )}
      <Box mb={3}>
        <Alert
          dismiss={false}
          title={intl.formatMessage({
            id: 'content__do_not_transfer_to_any_exchange_accounts_to_avoid_loss_of_assets',
          })}
          alertType="warn"
        />
      </Box>
      {feeInput && <Box mb={3}>{feeInput}</Box>}
      {tokenTransferInfo && <Box mb={3}>{tokenTransferInfo}</Box>}
      {!isSingleTransformMode && (
        <Text typography="Caption" color="text-subdued" mb={6}>
          {intl.formatMessage({
            id: 'content__to_ensure_that_the_transaction_will_be_successfully_sent',
          })}
        </Text>
      )}
    </>
  );
  const transactionDetailView = (
    <>
      <SendConfirmErrorBoundary>{children}</SendConfirmErrorBoundary>
      {platformEnv.isDev ? (
        <Text>
          {nativeBalance} {nativeToken?.symbol}
        </Text>
      ) : null}
    </>
  );

  return (
    <BaseSendModal
      size={!isVertical && !isSingleTransformMode ? 'xl' : 'xs'}
      height="598px"
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        isDisabled:
          isWatching ||
          balanceInsufficient ||
          isAccountNotMatched ||
          feeInfoLoading ||
          !feeInfoPayload ||
          !encodedTx ||
          !decodedTx ||
          isWaitingTxReady ||
          confirmDisabled,
      }}
      secondaryActionTranslationId="action__cancel"
      header={intl.formatMessage({
        id: isSingleTransformMode
          ? 'form__transaction'
          : 'form__multiple_transactions',
      })}
      onSecondaryActionPress={({ close }) => close()}
      onPrimaryActionPress={confirmAction}
      {...others}
      scrollViewProps={{
        children: (
          <>
            {isWaitingTxReady && (
              <Center minH="320px" w="full" h="full" flex={1}>
                <Spinner size="lg" />
              </Center>
            )}
            {!isWaitingTxReady &&
              (!isVertical && !isSingleTransformMode ? (
                <HStack space={6}>
                  <Box flex={1}>{transactionDetailView}</Box>
                  <Box flex={1}>{transactionInfoView}</Box>
                </HStack>
              ) : (
                <>
                  {transactionInfoView}
                  {transactionDetailView}
                </>
              ))}
          </>
        ),
      }}
    />
  );
}

export { BatchSendConfirmModalBase };

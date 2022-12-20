import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { toLower } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, Text } from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { isWatchingAccount } from '@onekeyhq/shared/src/engine/engineUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveSideAccount, useManageTokensOfAccount } from '../../../hooks';

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
    isSingleTransformMode,
    ...others
  } = props;

  const encodedTx = encodedTxs[0];
  const decodedTx = decodedTxs[0];
  const feeInfoPayload = feeInfoPayloads[0];

  const intl = useIntl();

  const { networkImpl, networkId, accountId, accountAddress } =
    useActiveSideAccount(props);

  const { nativeToken, getTokenBalance } = useManageTokensOfAccount({
    fetchTokensOnMount: true,
    accountId,
    networkId,
  });

  const nativeBalance = useMemo(
    () =>
      getTokenBalance({
        token: nativeToken,
        defaultValue: '0',
      }),
    [getTokenBalance, nativeToken],
  );

  const balanceInsufficient = useMemo(
    () => new BigNumber(nativeBalance).lt(new BigNumber(totalFeeInNative)),
    [totalFeeInNative, nativeBalance],
  );

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

  return (
    <BaseSendModal
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
            {!autoConfirm && (
              <SendConfirmErrorsAlert
                nativeToken={nativeToken}
                isWatchingAccount={isWatching}
                balanceInsufficient={balanceInsufficient}
                isAccountNotMatched={isAccountNotMatched}
              />
            )}
            <Box mb={6}>{feeInput}</Box>
            <SendConfirmErrorBoundary>{children}</SendConfirmErrorBoundary>

            {platformEnv.isDev ? (
              <Text>
                {nativeBalance} {nativeToken?.symbol}
              </Text>
            ) : null}
          </>
        ),
      }}
    />
  );
}

export { BatchSendConfirmModalBase };

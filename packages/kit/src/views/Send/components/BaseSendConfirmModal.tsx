import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { toLower } from 'lodash';
import { useIntl } from 'react-intl';

import { Text } from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { isWatchingAccount } from '@onekeyhq/engine/src/engineUtils';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveSideAccount, useManageTokensOfAccount } from '../../../hooks';
import { ITxConfirmViewProps } from '../types';

import { BaseSendModal } from './BaseSendModal';
import { DecodeTxButtonTest } from './DecodeTxButtonTest';
import { SendConfirmErrorBoundary } from './SendConfirmErrorBoundary';
import { SendConfirmErrorsAlert } from './SendConfirmErrorsAlert';

// TODO rename SendConfirmModalBase
function BaseSendConfirmModal(props: ITxConfirmViewProps) {
  const intl = useIntl();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { network, networkImpl, networkId, accountId, accountAddress } =
    useActiveSideAccount(props);
  const {
    children,
    encodedTx,
    decodedTx,
    confirmDisabled,
    feeInfoPayload,
    feeInfoLoading,
    handleConfirm,
    updateEncodedTxBeforeConfirm,
    autoConfirm,
    sourceInfo,
    ...others
  } = props;
  const { nativeToken, getTokenBalance } = useManageTokensOfAccount({
    fetchTokensOnMount: true,
    accountId,
    networkId,
  });
  const modalClose = useModalClose();

  const nativeBalance = useMemo(
    () =>
      getTokenBalance({
        token: nativeToken,
        defaultValue: '0',
      }),
    [getTokenBalance, nativeToken],
  );

  // TODO move to validator
  const fee = feeInfoPayload?.current?.totalNative ?? '0';

  const isAutoConfirmed = useRef(false);

  const balanceInsufficient = useMemo(
    () => new BigNumber(nativeBalance).lt(new BigNumber(fee)),
    [fee, nativeBalance],
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
      let tx = encodedTx;
      if (!tx) {
        return;
      }
      if (updateEncodedTxBeforeConfirm) {
        tx = await updateEncodedTxBeforeConfirm(tx);
      }
      handleConfirm({ close, onClose, encodedTx: tx });
    },
    [encodedTx, handleConfirm, updateEncodedTxBeforeConfirm],
  );
  useEffect(() => {
    if (autoConfirm && !feeInfoLoading && !isAutoConfirmed.current) {
      isAutoConfirmed.current = true;
      setTimeout(() => {
        confirmAction({ close: modalClose });
      }, 600);
    }
  }, [feeInfoLoading, autoConfirm, confirmAction, modalClose]);

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
      header={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
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

            <SendConfirmErrorBoundary>
              {children}
              <DecodeTxButtonTest
                accountId={accountId}
                networkId={networkId}
                encodedTx={encodedTx}
                feeInfoPayload={feeInfoPayload}
              />
            </SendConfirmErrorBoundary>

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
export { BaseSendConfirmModal };

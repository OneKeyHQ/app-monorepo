import React, { useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Modal } from '@onekeyhq/components';
import { FormErrorMessage } from '@onekeyhq/components/src/Form/FormErrorMessage';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import {
  IDecodedTxLegacy,
  IEncodedTx,
  IFeeInfoPayload,
} from '@onekeyhq/engine/src/vaults/types';

import { IDappCallParams } from '../../../background/IBackgroundApi';
import { useManageTokens } from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';
import { DecodeTxButtonTest } from '../DecodeTxButtonTest';
import { SendConfirmPayload } from '../types';

export type ITxConfirmViewPropsHandleConfirm = ({
  onClose,
  close,
  encodedTx,
}: {
  onClose?: () => void;
  close: () => void;
  encodedTx: IEncodedTx;
}) => void;
// TODO networkId, accountId, onSuccess
export type ITxConfirmViewProps = ModalProps & {
  // TODO rename sourceInfo
  sourceInfo?: IDappCallParams;
  encodedTx: IEncodedTx;
  decodedTx?: IDecodedTxLegacy | null;
  updateEncodedTxBeforeConfirm?: (encodedTx: IEncodedTx) => Promise<IEncodedTx>;
  confirmDisabled?: boolean;
  handleConfirm: ITxConfirmViewPropsHandleConfirm;
  onEncodedTxUpdate?: (encodedTx: IEncodedTx) => void; // TODO remove
  feeInfoPayload: IFeeInfoPayload | null;
  feeInfoLoading: boolean;
  feeInfoEditable?: boolean;
  payload?: SendConfirmPayload;
  children?: React.ReactElement;
  autoConfirm?: boolean;
};

// TODO rename SendConfirmModalBase
function SendConfirmModal(props: ITxConfirmViewProps) {
  const intl = useIntl();
  const { network, accountId } = useActiveWalletAccount();
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
    ...others
  } = props;
  const { nativeToken, getTokenBalance } = useManageTokens();
  const modalClose = useModalClose();

  // TODO move to validator
  const balanceInsufficient = useMemo(() => {
    const fee = feeInfoPayload?.current?.totalNative ?? '0';
    return new BigNumber(getTokenBalance(nativeToken, '0')).lt(
      new BigNumber(fee).plus(decodedTx?.amount ?? '0'),
    );
  }, [decodedTx?.amount, feeInfoPayload, getTokenBalance, nativeToken]);
  const isWatchingAccount = useMemo(
    () => accountId && accountId.startsWith('watching-'),
    [accountId],
  );

  const confirmAction = useCallback(
    async ({ close, onClose }) => {
      let tx = encodedTx;
      if (updateEncodedTxBeforeConfirm) {
        tx = await updateEncodedTxBeforeConfirm(tx);
      }
      handleConfirm({ close, onClose, encodedTx: tx });
    },
    [encodedTx, handleConfirm, updateEncodedTxBeforeConfirm],
  );
  useEffect(() => {
    if (autoConfirm && !feeInfoLoading) {
      confirmAction({ close: modalClose });
    }
  }, [feeInfoLoading, autoConfirm, confirmAction, modalClose]);

  return (
    <Modal
      height="598px"
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        isDisabled:
          isWatchingAccount ||
          feeInfoLoading ||
          balanceInsufficient ||
          !encodedTx ||
          !decodedTx ||
          confirmDisabled,
      }}
      secondaryActionTranslationId="action__reject"
      header={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      headerDescription={network?.name || network?.shortName || undefined}
      onSecondaryActionPress={({ close }) => close()}
      onPrimaryActionPress={confirmAction}
      {...others}
      scrollViewProps={{
        children: (
          <>
            {children}
            {!autoConfirm && (
              <>
                {isWatchingAccount ? (
                  <FormErrorMessage
                    message={intl.formatMessage({
                      id: 'form__error_trade_with_watched_acocunt' as any,
                    })}
                  />
                ) : null}
                {balanceInsufficient ? (
                  <FormErrorMessage
                    message={intl.formatMessage(
                      { id: 'form__amount_invalid' },
                      {
                        0: nativeToken?.symbol ?? '',
                      },
                    )}
                  />
                ) : null}
              </>
            )}
            <DecodeTxButtonTest encodedTx={encodedTx} />
          </>
        ),
      }}
    />
  );
}
export { SendConfirmModal };

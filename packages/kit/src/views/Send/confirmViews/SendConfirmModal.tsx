import React, { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Modal } from '@onekeyhq/components';
import { FormErrorMessage } from '@onekeyhq/components/src/Form/FormErrorMessage';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import {
  IDecodedTx,
  IEncodedTxAny,
  IFeeInfoPayload,
} from '@onekeyhq/engine/src/types/vault';

import { IDappCallParams } from '../../../background/IBackgroundApi';
import { useManageTokens } from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';
import { SendConfirmPayload } from '../types';

export type ITxConfirmViewPropsHandleConfirm = ({
  onClose,
  close,
  encodedTx,
}: {
  onClose?: () => void;
  close: () => void;
  encodedTx: IEncodedTxAny;
}) => void;
// TODO networkId, accountId, onSuccess
export type ITxConfirmViewProps = ModalProps & {
  // TODO rename sourceInfo
  sourceInfo?: IDappCallParams;
  encodedTx: IEncodedTxAny;
  decodedTx?: IDecodedTx;
  updateEncodedTxBeforeConfirm?: (
    encodedTx: IEncodedTxAny,
  ) => Promise<IEncodedTxAny>;
  confirmDisabled?: boolean;
  handleConfirm: ITxConfirmViewPropsHandleConfirm;
  onEncodedTxUpdate?: (encodedTx: IEncodedTxAny) => void; // TODO remove
  feeInfoPayload: IFeeInfoPayload | null;
  feeInfoLoading: boolean;
  feeInfoEditable?: boolean;
  payload?: SendConfirmPayload;
  children?: React.ReactElement;
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
    ...others
  } = props;
  const { nativeToken, getTokenBalance } = useManageTokens();

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
      onPrimaryActionPress={async ({ close, onClose }) => {
        let tx = encodedTx;
        if (updateEncodedTxBeforeConfirm) {
          tx = await updateEncodedTxBeforeConfirm(tx);
        }
        handleConfirm({ close, onClose, encodedTx: tx });
      }}
      {...others}
      scrollViewProps={{
        children: (
          <>
            {children}
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
        ),
      }}
    />
  );
}
export { SendConfirmModal };

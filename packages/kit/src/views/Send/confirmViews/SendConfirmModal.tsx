import React, { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Modal } from '@onekeyhq/components';
import { FormErrorMessage } from '@onekeyhq/components/src/Form/FormErrorMessage';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import {
  IEncodedTxAny,
  IFeeInfoPayload,
} from '@onekeyhq/engine/src/types/vault';

import { IDappCallParams } from '../../../background/IBackgroundApi';
import { useManageTokens } from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';
import { TransferSendParamsPayload } from '../types';

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
  decodedTx?: any;
  updateEncodedTxBeforeConfirm?: (
    encodedTx: IEncodedTxAny,
  ) => Promise<IEncodedTxAny>;
  confirmDisabled?: boolean;
  handleConfirm: ITxConfirmViewPropsHandleConfirm;
  onEncodedTxUpdate?: (encodedTx: IEncodedTxAny) => void; // TODO remove
  feeInfoPayload: IFeeInfoPayload | null;
  feeInfoLoading: boolean;
  feeInfoEditable?: boolean;
  payload?: any | TransferSendParamsPayload;
  children?: React.ReactElement;
};

// TODO rename SendConfirmModalBase
function SendConfirmModal(props: ITxConfirmViewProps) {
  const intl = useIntl();
  const { network } = useActiveWalletAccount();
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

  const { nativeToken } = useManageTokens();

  // TODO move to validator
  const balanceLessThanFee = useMemo(() => {
    const fee = feeInfoPayload?.current?.totalNative ?? '0';
    return new BigNumber(nativeToken?.balance ?? '0').lt(fee);
  }, [feeInfoPayload, nativeToken?.balance]);

  return (
    <Modal
      height="598px"
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        isDisabled:
          feeInfoLoading ||
          balanceLessThanFee ||
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
            {balanceLessThanFee ? (
              <FormErrorMessage
                message={intl.formatMessage({ id: 'form__amount_invalid' })}
              />
            ) : null}
          </>
        ),
      }}
    />
  );
}
export { SendConfirmModal };

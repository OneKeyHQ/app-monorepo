import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { toLower } from 'lodash';
import { useIntl } from 'react-intl';

import { Modal, Text } from '@onekeyhq/components';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { isWatchingAccount } from '@onekeyhq/engine/src/engineUtils';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IFeeInfoPayload,
} from '@onekeyhq/engine/src/vaults/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { IDappSourceInfo } from '../../../background/IBackgroundApi';
import { useActiveWalletAccount, useManageTokens } from '../../../hooks';
import { DecodeTxButtonTest } from '../DecodeTxButtonTest';
import { SendConfirmParams, SendConfirmPayload } from '../types';

import { SendConfirmErrorBoundary } from './SendConfirmErrorBoundary';
import { SendConfirmErrorsAlert } from './SendConfirmErrorsAlert';

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
  sourceInfo?: IDappSourceInfo;
  encodedTx: IEncodedTx | null;
  decodedTx?: IDecodedTx | IDecodedTxLegacy | null;
  payload?: SendConfirmPayload;

  updateEncodedTxBeforeConfirm?: (encodedTx: IEncodedTx) => Promise<IEncodedTx>;
  handleConfirm: ITxConfirmViewPropsHandleConfirm;
  onEncodedTxUpdate?: (encodedTx: IEncodedTx) => void; // TODO remove

  feeInfoPayload: IFeeInfoPayload | null;
  feeInfoLoading: boolean;
  feeInfoEditable?: boolean;
  feeInput?: JSX.Element;

  confirmDisabled?: boolean;
  autoConfirm?: boolean;
  children?: JSX.Element | JSX.Element[] | Element | Element[] | any;

  sendConfirmParams: SendConfirmParams;
};

// TODO rename SendConfirmModalBase
function SendConfirmModal(props: ITxConfirmViewProps) {
  const intl = useIntl();
  const { network, networkImpl, accountId, accountAddress } =
    useActiveWalletAccount();
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
  const { nativeToken, getTokenBalance } = useManageTokens({
    fetchTokensOnMount: true,
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
      if (tx && toLower(tx.from) !== toLower(accountAddress)) {
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
    <Modal
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
      secondaryActionTranslationId="action__reject"
      header={intl.formatMessage({ id: 'transaction__transaction_confirm' })}
      headerDescription={network?.name || network?.shortName || undefined}
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
              <DecodeTxButtonTest encodedTx={encodedTx} />
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
export { SendConfirmModal };

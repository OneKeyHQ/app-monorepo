import React, { useCallback, useEffect, useMemo } from 'react';

import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Modal } from '@onekeyhq/components';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import {
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IFeeInfoPayload,
} from '@onekeyhq/engine/src/vaults/types';

import { IDappSourceInfo } from '../../../background/IBackgroundApi';
import { useActiveWalletAccount, useManageTokens } from '../../../hooks';
import { DecodeTxButtonTest } from '../DecodeTxButtonTest';
import { SendConfirmPayload } from '../types';

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
    sourceInfo,
    ...others
  } = props;
  const { nativeToken, getTokenBalance } = useManageTokens({
    fetchTokensOnMount: true,
  });
  const modalClose = useModalClose();

  // TODO move to validator
  const balanceInsufficient = useMemo(() => {
    const fee = feeInfoPayload?.current?.totalNative ?? '0';
    const nativeBalance = getTokenBalance({
      token: nativeToken,
      defaultValue: '0',
    });
    return new BigNumber(nativeBalance).lt(new BigNumber(fee));
  }, [feeInfoPayload, getTokenBalance, nativeToken]);

  const isWatchingAccount = useMemo(
    () => !!(accountId && accountId.startsWith('watching-')),
    [accountId],
  );

  const isNetworkNotMatched = useMemo(() => {
    if (!sourceInfo) {
      return false;
    }
    // dapp tx should check scope matched
    // TODO add injectedProviderName to vault settings
    return sourceInfo.scope !== IInjectedProviderNames.ethereum; // network.settings.injectedProviderName
  }, [sourceInfo]);

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
          isNetworkNotMatched ||
          isWatchingAccount ||
          balanceInsufficient ||
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
                isWatchingAccount={isWatchingAccount}
                balanceInsufficient={balanceInsufficient}
                isNetworkNotMatched={isNetworkNotMatched}
              />
            )}

            {children}

            <DecodeTxButtonTest encodedTx={encodedTx} />
          </>
        ),
      }}
    />
  );
}
export { SendConfirmModal };

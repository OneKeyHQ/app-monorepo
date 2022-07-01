import React, { useMemo } from 'react';

import { Modal } from '@onekeyhq/components';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { IDappSourceInfo } from '../../../background/IBackgroundApi';
import { useActiveWalletAccount } from '../../../hooks/redux';

export type ISignMessageConfirmViewPropsHandleConfirm = ({
  onClose,
  close,
  unsignedMessage,
}: {
  onClose?: () => void;
  close: () => void;
  unsignedMessage: IUnsignedMessageEvm;
}) => void;

export type ISignMessageConfirmViewProps = ModalProps & {
  // TODO rename sourceInfo
  sourceInfo?: IDappSourceInfo;
  unsignedMessage: IUnsignedMessageEvm;
  confirmDisabled?: boolean;
  handleConfirm: ISignMessageConfirmViewPropsHandleConfirm;
  children?: React.ReactElement;
};

function SignMessageConfirmModal(props: ISignMessageConfirmViewProps) {
  const { accountId } = useActiveWalletAccount();
  const {
    children,
    confirmDisabled,
    handleConfirm,
    unsignedMessage,
    ...others
  } = props;

  const isWatchingAccount = useMemo(
    () => accountId && accountId.startsWith('watching-'),
    [accountId],
  );

  const isBlindSign = unsignedMessage.type === ETHMessageTypes.ETH_SIGN;

  return (
    <Modal
      height="598px"
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        type: isBlindSign ? 'destructive' : 'primary',
        isDisabled: isWatchingAccount || confirmDisabled,
      }}
      secondaryActionTranslationId="action__reject"
      onSecondaryActionPress={({ close }) => close()}
      onPrimaryActionPress={({ close, onClose }) => {
        handleConfirm({ close, onClose, unsignedMessage });
      }}
      {...others}
      scrollViewProps={{
        children,
      }}
    />
  );
}
export { SignMessageConfirmModal };

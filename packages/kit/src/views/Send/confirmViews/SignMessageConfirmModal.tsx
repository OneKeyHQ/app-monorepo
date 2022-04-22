import React, { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Modal } from '@onekeyhq/components';
import { FormErrorMessage } from '@onekeyhq/components/src/Form/FormErrorMessage';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { IDappCallParams } from '../../../background/IBackgroundApi';
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
  sourceInfo?: IDappCallParams;
  unsignedMessage: IUnsignedMessageEvm;
  confirmDisabled?: boolean;
  handleConfirm: ISignMessageConfirmViewPropsHandleConfirm;
  children?: React.ReactElement;
};

function SignMessageConfirmModal(props: ISignMessageConfirmViewProps) {
  const intl = useIntl();
  const { network, accountId } = useActiveWalletAccount();
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

  return (
    <Modal
      height="598px"
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        isDisabled: isWatchingAccount || confirmDisabled,
      }}
      secondaryActionTranslationId="action__reject"
      header={intl.formatMessage({ id: 'title__signature_request' })}
      headerDescription={network?.name || network?.shortName || undefined}
      onSecondaryActionPress={({ close }) => close()}
      onPrimaryActionPress={({ close, onClose }) => {
        handleConfirm({ close, onClose, unsignedMessage });
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
          </>
        ),
      }}
    />
  );
}
export { SignMessageConfirmModal };

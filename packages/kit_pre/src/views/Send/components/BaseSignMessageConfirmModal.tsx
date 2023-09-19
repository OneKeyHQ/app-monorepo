import { useMemo } from 'react';

import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';

import { useActiveSideAccount } from '../../../hooks';

import { BaseSendModal } from './BaseSendModal';

import type { ISignMessageConfirmViewProps } from '../types';

function BaseSignMessageConfirmModal(props: ISignMessageConfirmViewProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { walletId, accountId, networkId } = useActiveSideAccount(props);

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
    <BaseSendModal
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
      accountId={accountId}
      networkId={networkId}
      scrollViewProps={{
        children,
      }}
    />
  );
}
export { BaseSignMessageConfirmModal };

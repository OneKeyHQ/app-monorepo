import { memo } from 'react';

import type { IStackProps } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';

import MessageExtraInfoSol from './MessageExtraInfoSol';

type IProps = {
  networkId: string;
  unsignedMessage: IUnsignedMessage;
};

export function getMessageExtraInfo({ impl }: { impl: string }) {
  let component:
    | ((props: {
        unsignedMessage: IUnsignedMessage;
        style?: IStackProps;
      }) => React.ReactNode | null)
    | undefined;
  switch (impl) {
    case IMPL_SOL:
      component = MessageExtraInfoSol;
      break;
    default:
      break;
  }

  return component;
}

/**
 * Chain specific fields shown alongside a message signing request, mirroring
 * {@link TxConfirmExtraInfo} for transactions. Keeps chain branches out of the shared
 * message viewers, which only derive the displayed string.
 */
function MessageConfirmExtraInfo(props: IProps) {
  const { networkId, unsignedMessage } = props;
  const { network } = useAccountData({ networkId });
  const MessageExtraInfo = getMessageExtraInfo({ impl: network?.impl ?? '' });

  if (MessageExtraInfo) {
    return <MessageExtraInfo unsignedMessage={unsignedMessage} />;
  }

  return null;
}

export default memo(MessageConfirmExtraInfo);

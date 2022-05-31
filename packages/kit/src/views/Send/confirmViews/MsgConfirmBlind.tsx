import React from 'react';

import SignDetail from '../../TxDetail/SignDetail';

import {
  ISignMessageConfirmViewProps,
  SignMessageConfirmModal,
} from './SignMessageConfirmModal';

function MsgConfirmBlind(props: ISignMessageConfirmViewProps) {
  return (
    <SignMessageConfirmModal {...props}>
      <SignDetail {...props} />
    </SignMessageConfirmModal>
  );
}
export { MsgConfirmBlind };

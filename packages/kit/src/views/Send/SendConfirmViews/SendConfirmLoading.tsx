import React from 'react';

import { Center, Spinner } from '@onekeyhq/components';

import { ITxConfirmViewProps, SendConfirmModal } from './SendConfirmModal';

function SendConfirmLoading(props: ITxConfirmViewProps) {
  return (
    <SendConfirmModal {...props} confirmDisabled>
      <Center flex="1">
        <Spinner />
      </Center>
    </SendConfirmModal>
  );
}

export { SendConfirmLoading };

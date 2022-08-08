import React from 'react';

import { Center, Spinner } from '@onekeyhq/components';

import { ITxConfirmViewProps, SendConfirmModal } from './SendConfirmModal';

function SendConfirmLoading(props: ITxConfirmViewProps) {
  return (
    <SendConfirmModal {...props} confirmDisabled>
      <Center minH="320px" w="full" h="full" flex={1}>
        <Spinner size="lg" />
      </Center>
    </SendConfirmModal>
  );
}

export { SendConfirmLoading };

import React from 'react';

import { Center, Spinner } from '@onekeyhq/components';

import { BaseSendConfirmModal } from '../../components/BaseSendConfirmModal';
import { ITxConfirmViewProps } from '../../types';

function SendConfirmLoading(props: ITxConfirmViewProps) {
  return (
    <BaseSendConfirmModal {...props} confirmDisabled>
      <Center minH="320px" w="full" h="full" flex={1}>
        <Spinner size="lg" />
      </Center>
    </BaseSendConfirmModal>
  );
}

export { SendConfirmLoading };

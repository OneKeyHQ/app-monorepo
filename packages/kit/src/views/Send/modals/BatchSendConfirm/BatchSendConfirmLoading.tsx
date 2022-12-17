import { Center, Spinner } from '@onekeyhq/components';

import { BatchSendConfirmModalBase } from '../../components/BatchSendConfirmModalBase';

import type { IBatchTxsConfirmViewProps } from '../../types';

function BatchSendConfirmLoading(props: IBatchTxsConfirmViewProps) {
  return (
    <BatchSendConfirmModalBase {...props} confirmDisabled>
      <Center minH="320px" w="full" h="full" flex={1}>
        <Spinner size="lg" />
      </Center>
    </BatchSendConfirmModalBase>
  );
}

export { BatchSendConfirmLoading };

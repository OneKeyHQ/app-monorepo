import { useEffect, useState } from 'react';

import { Box, Textarea } from '@onekeyhq/components';

import { useDebounce } from '../../../hooks';
import { decodeReceiver, encodeReceiver } from '../utils';

import { ReceiverErrors } from './ReceiverErrors';

import type { ReceiverInputParams } from '../types';

type Props = Omit<ReceiverInputParams, 'isUploadMode' | 'setIsUploadMode'>;

function ReceiverEditor(props: Props) {
  const { receiverFromOut, setReceiver, type, receiverErrors } = props;

  const [receiverString, setReceiverString] = useState('');

  const receiverStringDebounce = useDebounce(receiverString, 1000);

  useEffect(() => {
    setReceiver(decodeReceiver(receiverStringDebounce, type));
  }, [receiverStringDebounce, setReceiver, type]);

  useEffect(() => {
    if (receiverFromOut.length > 0) {
      setReceiverString(encodeReceiver(receiverFromOut));
    }
  }, [receiverFromOut]);

  return (
    <Box>
      <Textarea
        value={receiverString}
        h="240px"
        // @ts-ignore
        onChange={(e) => setReceiverString(e.currentTarget.value)}
      />
      <Box mt={3}>
        <ReceiverErrors errors={receiverErrors} />
      </Box>
    </Box>
  );
}

export { ReceiverEditor };

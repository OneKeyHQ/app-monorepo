import { useEffect, useState } from 'react';

import { Box } from '@onekeyhq/components';

import { useDebounce } from '../../../hooks';
import { TextareaWithLineNumber } from '../TextareaWithLineNumber';
import { decodeReceiver, encodeReceiver } from '../utils';

import { ReceiverErrors } from './ReceiverErrors';

import type { ReceiverInputParams } from '../types';

type Props = Omit<ReceiverInputParams, 'isUploadMode' | 'setIsUploadMode'>;

function ReceiverEditor(props: Props) {
  const { receiverFromOut, setReceiver, type, receiverErrors } = props;

  const [receiverString, setReceiverString] = useState('');

  const receiverStringDebounce = useDebounce(receiverString, 500, {
    leading: true,
  });

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
      <TextareaWithLineNumber
        receiverString={receiverString}
        setReceiverString={setReceiverString}
      />
      <Box mt={3}>
        <ReceiverErrors receiverErrors={receiverErrors} showFileError={false} />
      </Box>
    </Box>
  );
}

export { ReceiverEditor };

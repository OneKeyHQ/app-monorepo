import { useEffect, useState } from 'react';

import { Textarea } from '@onekeyhq/components';

import type { ReceiverInputParams } from '../types';

type Props = Omit<ReceiverInputParams, 'isUploadMode' | 'setIsUploadMode'>;

function ReceiverEditor(props: Props) {
  const { receiverFromOut } = props;

  const [textAreaValue, setTextAreaValue] = useState('');

  useEffect(() => {
    if (receiverFromOut.length > 0) {
      setTextAreaValue(
        receiverFromOut.reduce(
          (acc, cur) => `${acc}${[cur.Address, cur.Amount].join(',')}\n`,
          '',
        ),
      );
    }
  }, [receiverFromOut]);

  return (
    <>
      <Textarea
        value={textAreaValue}
        h="148px"
        // @ts-ignore
        onChange={(e) => setTextAreaValue(e.currentTarget.value)}
        onChangeText={(text) => setTextAreaValue(text)}
      />
      <h1>error</h1>
    </>
  );
}

export { ReceiverEditor };

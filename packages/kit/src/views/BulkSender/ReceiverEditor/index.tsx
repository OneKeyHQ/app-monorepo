import { useEffect, useState } from 'react';

import {
  Box,
  Center,
  HStack,
  Icon,
  Pressable,
  Text,
  Textarea,
} from '@onekeyhq/components';

import type { TokenReceiver } from '../types';

interface Props {
  setReceiver: React.Dispatch<React.SetStateAction<TokenReceiver[]>>;
  receiver: TokenReceiver[];
}
function ReceiverEditor(props: Props) {
  const { receiver } = props;

  const [textAreaValue, setTextAreaValue] = useState('');

  useEffect(() => {
    if (receiver.length > 0) {
      setTextAreaValue(
        receiver.reduce(
          (acc, cur) => `${acc}${[cur.Address, cur.Amount].join(',')}\n`,
          '',
        ),
      );
    }
  }, [receiver]);

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

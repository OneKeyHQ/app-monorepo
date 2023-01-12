import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  Text,
  Textarea,
} from '@onekeyhq/components';

import { useDropUpload } from '../hooks';
import { ReceiverEnum } from '../types';

import type { TokenReceiver } from '../types';

interface Props {
  setReceiver: React.Dispatch<React.SetStateAction<TokenReceiver[]>>;
  receiver: TokenReceiver[];
}
function ReceiverEditor(props: Props) {
  const { receiver, setReceiver } = props;

  const intl = useIntl();

  const [textAreaValue, setTextAreaValue] = useState('');
  const { isDragAccept, data, getRootProps } = useDropUpload<TokenReceiver>({
    header: [ReceiverEnum.Address, ReceiverEnum.Amount],
    noClick: true,
  });

  useEffect(() => {
    if (receiver.length > 0) {
      setTextAreaValue(
        receiver.reduce(
          (acc, cur) => `${acc}${[cur.Address, cur.Amount].join(',')}\n`,
          '',
        ),
      );
    }
  }, [receiver, data]);

  useEffect(() => {
    if (data && data[0] && data[0].Address && data[0].Amount) {
      setReceiver(
        data.filter(
          (item) =>
            item.Address !== ReceiverEnum.Address &&
            item.Amount !== ReceiverEnum.Amount,
        ),
      );
    }
  }, [data, setReceiver]);

  return (
    <Box>
      <div style={{ width: '100%', height: '100%' }} {...getRootProps()}>
        <Textarea
          bg="surface-default"
          value={textAreaValue}
          h="240px"
          // @ts-ignore
          onChange={(e) => setTextAreaValue(e.currentTarget.value)}
          onChangeText={(text) => setTextAreaValue(text)}
        />
        {isDragAccept && (
          <Center
            flex="1"
            bg="backdrop"
            zIndex={999}
            position="absolute"
            left="0"
            right="0"
            top="0"
            bottom="0"
            borderRadius={12}
          >
            <Box
              bg="surface-default"
              borderWidth={1}
              borderColor="interactive-default"
              w="358px"
              borderRadius={12}
              h="148px"
            >
              <Center h="full">
                <Icon name="DocumentArrowUpOutline" size={38} />
                <Text mt={5}>
                  {intl.formatMessage({ id: 'form__drag_file_here' })}
                </Text>
              </Center>
            </Box>
          </Center>
        )}
      </div>
    </Box>
  );
}

export { ReceiverEditor };

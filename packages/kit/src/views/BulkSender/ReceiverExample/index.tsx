import { useIntl } from 'react-intl';

import { HStack, Pressable, Text } from '@onekeyhq/components';

import { ReceiverExampleType } from '../types';
import { downloadReceiverExample } from '../utils';

function ReceiverExample() {
  const intl = useIntl();
  return (
    <HStack space="10px">
      <Text fontSize={14} color="text-subdued">
        {intl.formatMessage({ id: 'content__download_example' })}:
      </Text>
      <Pressable
        onPress={() => downloadReceiverExample(ReceiverExampleType.CSV)}
      >
        <Text fontSize={14} color="text-subdued" textDecorationLine="underline">
          CSV,
        </Text>
      </Pressable>
      <Pressable
        onPress={() => downloadReceiverExample(ReceiverExampleType.TXT)}
      >
        <Text fontSize={14} color="text-subdued" textDecorationLine="underline">
          TXT,
        </Text>
      </Pressable>
      <Pressable
        onPress={() => downloadReceiverExample(ReceiverExampleType.Excel)}
      >
        <Text fontSize={14} color="text-subdued" textDecorationLine="underline">
          Excel
        </Text>
      </Pressable>
    </HStack>
  );
}

export { ReceiverExample };

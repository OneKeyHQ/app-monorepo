import { useIntl } from 'react-intl';

import { HStack, Pressable, Text } from '@onekeyhq/components';

import { TraderExampleType } from '../types';
import { downloadTraderExample } from '../utils';

function TraderExample() {
  const intl = useIntl();
  return (
    <HStack space="10px">
      <Text fontSize={14} color="text-subdued">
        {intl.formatMessage({ id: 'content__download_example' })}:
      </Text>
      <Pressable onPress={() => downloadTraderExample(TraderExampleType.CSV)}>
        <Text fontSize={14} color="text-subdued" textDecorationLine="underline">
          CSV,
        </Text>
      </Pressable>
      <Pressable onPress={() => downloadTraderExample(TraderExampleType.TXT)}>
        <Text fontSize={14} color="text-subdued" textDecorationLine="underline">
          TXT,
        </Text>
      </Pressable>
      <Pressable onPress={() => downloadTraderExample(TraderExampleType.Excel)}>
        <Text fontSize={14} color="text-subdued" textDecorationLine="underline">
          Excel
        </Text>
      </Pressable>
    </HStack>
  );
}

export { TraderExample };

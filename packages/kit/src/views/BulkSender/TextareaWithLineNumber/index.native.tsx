import { useCallback, useRef } from 'react';

import { ScrollView, View } from 'react-native';

import { Box, Text, Textarea } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  NativeSyntheticEvent,
  TextInput,
  TextInputScrollEventData,
} from 'react-native';

type Props = {
  receiverString: string;
  setReceiverString: React.Dispatch<React.SetStateAction<string>>;
};

function TextareaWithLineNumber(props: Props) {
  const textAreaRef = useRef<TextInput>();
  const textAreaLineNumberScrollViewRef = useRef<ScrollView>();
  const { receiverString, setReceiverString } = props;

  const lines = receiverString.split('\n');

  const handleTextareaOnScroll = useCallback(
    (e: NativeSyntheticEvent<TextInputScrollEventData>) => {
      (textAreaLineNumberScrollViewRef.current as ScrollView)?.scrollTo({
        y: e.nativeEvent.contentOffset.y,
        animated: false,
      });
    },
    [],
  );
  return (
    <Box position="relative">
      <Textarea
        // @ts-ignore
        ref={textAreaRef}
        onScroll={handleTextareaOnScroll}
        bgColor="transparent"
        bg="transparent"
        value={receiverString}
        pl="46px"
        py={platformEnv.isNativeIOS ? 1 : 2}
        h="240px"
        lineHeight="24px"
        fontWeight={500}
        fontFamily={platformEnv.isNativeIOS ? 'Menlo' : 'monospace'}
        shadow="none"
        onChangeText={(text) => setReceiverString(text)}
      />
      <View
        style={{
          zIndex: -1,
          height: 240,
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <ScrollView
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={{ width: '100%' }}
          // @ts-ignore
          ref={textAreaLineNumberScrollViewRef}
        >
          <Box
            px={3}
            py={2}
            borderWidth={1}
            w="full"
            h="99999px"
            bg="action-secondary-default"
            borderColor="transparent"
          >
            {lines.map((line, index) => (
              <Text
                fontWeight={500}
                fontSize={16}
                color="text-disabled"
                fontFamily={platformEnv.isNativeIOS ? 'Menlo' : 'monospace'}
                lineHeight="24px"
              >
                {index + 1}
                <Text
                  fontWeight={500}
                  fontSize={16}
                  lineHeight="24px"
                  color="transparent"
                  fontFamily={platformEnv.isNativeIOS ? 'Menlo' : 'monospace'}
                >
                  {new Array(3).join('0')}
                  {line}
                </Text>
              </Text>
            ))}
          </Box>
        </ScrollView>
      </View>
    </Box>
  );
}

export { TextareaWithLineNumber };

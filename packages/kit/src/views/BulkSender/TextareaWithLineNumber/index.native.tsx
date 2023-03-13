import { useCallback, useRef } from 'react';

import { ScrollView, View } from 'react-native';

import { Box, Text, Textarea } from '@onekeyhq/components';

import type {
  NativeSyntheticEvent,
  TextInput,
  TextInputScrollEventData,
  ViewStyle,
} from 'react-native';

type Props = {
  receiverString: string;
  setReceiverString: React.Dispatch<React.SetStateAction<string>>;
  height?: string | number;
  containerStyle?: ViewStyle;
  readonly?: boolean;
};

function TextareaWithLineNumber(props: Props) {
  const textAreaRef = useRef<TextInput>();
  const textAreaLineNumberScrollViewRef = useRef<ScrollView>();
  const {
    receiverString,
    setReceiverString,
    height,
    containerStyle,
    readonly,
  } = props;

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
    <Box position="relative" style={containerStyle}>
      <Textarea
        // @ts-ignore
        ref={textAreaRef}
        onScroll={handleTextareaOnScroll}
        bgColor="transparent"
        bg="transparent"
        value={receiverString}
        pl="46px"
        py={2}
        h={height}
        lineHeight="24px"
        fontWeight={500}
        fontFamily="monospace"
        shadow="none"
        isReadOnly={readonly}
        onChangeText={(text) => setReceiverString(text)}
      />
      <View
        style={{
          zIndex: -1,
          height,
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
                fontFamily="monospace"
                lineHeight="24px"
              >
                {index + 1}
                <Text
                  fontWeight={500}
                  fontSize={16}
                  lineHeight="24px"
                  color="transparent"
                  fontFamily="monospace"
                >
                  {new Array(3).join(' ')}
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

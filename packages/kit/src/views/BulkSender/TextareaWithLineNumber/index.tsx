import { useCallback, useLayoutEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Box, Textarea } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { encodeReceiverWithLineNumber } from '../utils';

import type { ViewStyle } from 'react-native';

type Props = {
  receiverString: string;
  setReceiverString: React.Dispatch<React.SetStateAction<string>>;
  height?: string | number;
  containerStyle?: ViewStyle;
  readonly?: boolean;
};

function TextareaWithLineNumber(props: Props) {
  const textAreaRef = useRef<HTMLTextAreaElement>();
  const textAreaLineNumberRef = useRef<HTMLTextAreaElement>();
  const {
    receiverString,
    setReceiverString,
    containerStyle,
    height = '240px',
    readonly,
  } = props;

  const intl = useIntl();

  const receiverStringWithLineNumber =
    encodeReceiverWithLineNumber(receiverString);

  const handleTextareaOnScroll = useCallback(() => {
    (textAreaLineNumberRef.current as HTMLTextAreaElement)?.scrollTo({
      top: (textAreaRef.current as HTMLTextAreaElement)?.scrollTop,
    });
  }, []);

  useLayoutEffect(() => {
    if (textAreaLineNumberRef.current) {
      textAreaLineNumberRef.current.style.whiteSpace = 'break-spaces';
    }
  }, []);

  return (
    <Box position="relative" style={containerStyle}>
      <Textarea
        // @ts-ignore
        ref={textAreaRef}
        placeholder={intl.formatMessage({
          id: 'form__receiver_address_amount',
        })}
        onScroll={handleTextareaOnScroll}
        bgColor="transparent"
        bg="transparent"
        value={receiverString}
        pl="46px"
        h={height}
        margin="1px"
        shadow="none"
        fontFamily={platformEnv.isNativeIOS ? 'Menlo' : 'monospace'}
        isReadOnly={readonly}
        onChangeText={(text) => setReceiverString(text)}
      />
      <Textarea
        // @ts-ignore
        ref={textAreaLineNumberRef}
        borderColor="transparent"
        color="text-disabled"
        value={receiverStringWithLineNumber}
        h={height}
        fontFamily="monospace"
        position="absolute"
        zIndex={-1}
        left="1px"
        top="1px"
        right="1px"
        bottom="1px"
        isReadOnly
      />
    </Box>
  );
}

export { TextareaWithLineNumber };

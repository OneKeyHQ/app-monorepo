import { useCallback, useLayoutEffect, useRef } from 'react';

import { Box, Textarea } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { encodeTraderWithLineNumber } from '../utils';

type Props = {
  traderString: string;
  setTraderString: React.Dispatch<React.SetStateAction<string>>;
};

function TextareaWithLineNumber(props: Props) {
  const textAreaRef = useRef<HTMLTextAreaElement>();
  const textAreaLineNumberRef = useRef<HTMLTextAreaElement>();
  const { traderString, setTraderString } = props;

  const traderStringWithLineNumber = encodeTraderWithLineNumber(traderString);

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
    <Box position="relative">
      <Textarea
        // @ts-ignore
        ref={textAreaRef}
        onScroll={handleTextareaOnScroll}
        bgColor="transparent"
        bg="transparent"
        value={traderString}
        pl="46px"
        h="240px"
        margin="1px"
        shadow="none"
        fontFamily={platformEnv.isNativeIOS ? 'Menlo' : 'monospace'}
        onChangeText={(text) => setTraderString(text)}
      />
      <Textarea
        // @ts-ignore
        ref={textAreaLineNumberRef}
        borderColor="transparent"
        color="text-disabled"
        value={traderStringWithLineNumber}
        h="240px"
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

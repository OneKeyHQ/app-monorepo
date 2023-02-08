import { useCallback, useLayoutEffect, useRef } from 'react';

import { Box, Textarea } from '@onekeyhq/components';

import { encodeReceiverWithLineNumber } from '../utils';

type Props = {
  receiverString: string;
  setReceiverString: React.Dispatch<React.SetStateAction<string>>;
};

function TextareaWithLineNumber(props: Props) {
  const textAreaRef = useRef<HTMLTextAreaElement>();
  const textAreaLineNumberRef = useRef<HTMLTextAreaElement>();
  const { receiverString, setReceiverString } = props;

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
    <Box position="relative">
      <Textarea
        // @ts-ignore
        ref={textAreaRef}
        onScroll={handleTextareaOnScroll}
        bgColor="transparent"
        bg="transparent"
        value={receiverString}
        pl="46px"
        h="240px"
        shadow="none"
        fontFamily="monospace"
        onChangeText={(text) => setReceiverString(text)}
      />
      <Textarea
        // @ts-ignore
        ref={textAreaLineNumberRef}
        borderColor="transparent"
        color="text-disabled"
        value={receiverStringWithLineNumber}
        h="240px"
        fontFamily="monospace"
        position="absolute"
        zIndex={-1}
        left={0}
        top={0}
        right={0}
        bottom={0}
        isReadOnly
      />
    </Box>
  );
}

export { TextareaWithLineNumber };

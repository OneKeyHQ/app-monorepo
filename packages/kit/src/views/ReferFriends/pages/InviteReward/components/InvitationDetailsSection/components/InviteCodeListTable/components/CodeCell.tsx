import { useCallback } from 'react';

import {
  Icon,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';

export function CodeCell({ code }: { code: string }) {
  const { copyText } = useClipboard();

  const handleCopy = useCallback(() => {
    void copyText(code);
  }, [code, copyText]);

  return (
    <XStack gap="$2" ai="center">
      <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
        {code}
      </SizableText>
      <Stack
        cursor="pointer"
        onPress={handleCopy}
        p="$1"
        borderRadius="$2"
        hoverStyle={{
          backgroundColor: '$bgHover',
        }}
        pressStyle={{
          backgroundColor: '$bgActive',
        }}
      >
        <Icon name="Copy3Outline" size="$4" color="$iconSubdued" />
      </Stack>
    </XStack>
  );
}

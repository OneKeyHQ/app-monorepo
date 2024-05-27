import { useCallback, useRef, useState } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import {
  Button,
  SizableText,
  Stack,
  YStack,
  useMedia,
} from '@onekeyhq/components';

import type { LayoutChangeEvent } from 'react-native';

function ViewMoreText({ children, ...props }: ISizableTextProps) {
  const [layoutTimes, setLayoutTimes] = useState(0);
  const [numberOfLines, setNumberOfLines] = useState<number | undefined>(6);
  const fullTextHeight = useRef(0);
  const onLayoutFullText = useCallback(
    ({
      nativeEvent: {
        layout: { height },
      },
    }: LayoutChangeEvent) => {
      fullTextHeight.current = height;
      setLayoutTimes((prev) => prev + 1);
    },
    [],
  );

  const trimmedTextHeight = useRef(0);
  const onLayoutTrimmedText = useCallback(
    ({
      nativeEvent: {
        layout: { height },
      },
    }: LayoutChangeEvent) => {
      trimmedTextHeight.current = height;
      setLayoutTimes((prev) => prev + 1);
    },
    [],
  );

  const handleViewMore = useCallback(() => {
    setNumberOfLines(undefined);
  }, []);

  const isFullTextShown = layoutTimes < 2;

  return (
    <YStack>
      <YStack space="$3">
        <Stack onLayout={onLayoutTrimmedText}>
          <SizableText numberOfLines={numberOfLines} {...props}>
            {children}
          </SizableText>
        </Stack>
        {trimmedTextHeight.current < fullTextHeight.current ? (
          <Button size="medium" variant="secondary" onPress={handleViewMore}>
            View More
          </Button>
        ) : null}
      </YStack>
      {isFullTextShown ? (
        <Stack
          onLayout={onLayoutFullText}
          opacity={0}
          position="absolute"
          left={0}
          top={0}
        >
          <SizableText {...props}>{children}</SizableText>
        </Stack>
      ) : null}
    </YStack>
  );
}

export function MarketAbout({
  children,
}: {
  children: ISizableTextProps['children'];
}) {
  const { gtMd } = useMedia();
  return (
    <YStack space="$3" pt="$10">
      <SizableText size="$headingSm">About</SizableText>
      {gtMd ? (
        <ViewMoreText color="$textSubdued">{children}</ViewMoreText>
      ) : (
        <SizableText size="$bodyMd" color="$textSubdued">
          {children}
        </SizableText>
      )}
    </YStack>
  );
}

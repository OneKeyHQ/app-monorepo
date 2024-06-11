import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps, ISizableTextProps } from '@onekeyhq/components';
import { Button, SizableText, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { LayoutChangeEvent } from 'react-native';

const DEFAULT_NUMBER_OF_LINES = 6;
function ViewMoreText({ children, ...props }: ISizableTextProps) {
  const intl = useIntl();
  const [layoutTimes, setLayoutTimes] = useState(0);
  const [numberOfLines, setNumberOfLines] = useState<number | undefined>(
    DEFAULT_NUMBER_OF_LINES,
  );
  const fullTextHeight = useRef(0);
  const onLayoutFullText = useCallback(
    ({
      nativeEvent: {
        layout: { height },
      },
    }: LayoutChangeEvent) => {
      if (!fullTextHeight.current) {
        fullTextHeight.current = height;
        setLayoutTimes((prev) => prev + 1);
      }
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
      if (!trimmedTextHeight.current) {
        trimmedTextHeight.current = height;
      }
      setLayoutTimes((prev) => prev + 1);
    },
    [],
  );

  const isShowViewButton = trimmedTextHeight.current < fullTextHeight.current;
  const handleViewMore = useCallback(() => {
    setNumberOfLines((prev) => (prev ? undefined : DEFAULT_NUMBER_OF_LINES));
  }, []);

  const isFullTextShown = layoutTimes < 2;

  return (
    <YStack>
      <YStack space="$3">
        <Stack onLayout={onLayoutTrimmedText}>
          <SizableText size="$bodyMd" numberOfLines={numberOfLines} {...props}>
            {children}
          </SizableText>
        </Stack>
        {isShowViewButton ? (
          <Button
            size="medium"
            variant="secondary"
            onPress={handleViewMore}
            $gtMd={{ size: 'small' } as IButtonProps}
          >
            {intl.formatMessage({
              id: numberOfLines
                ? ETranslations.global_view_more
                : ETranslations.global_view_less,
            })}
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
          <SizableText size="$bodyMd" {...props}>
            {children}
          </SizableText>
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
  const intl = useIntl();
  return children ? (
    <YStack space="$3" pt="$10">
      <SizableText size="$headingSm">
        {intl.formatMessage({ id: ETranslations.global_about })}
      </SizableText>
      <ViewMoreText color="$textSubdued">{children}</ViewMoreText>
    </YStack>
  ) : null;
}

import { useCallback } from 'react';
import type { ComponentProps, PropsWithChildren } from 'react';

import {
  Icon,
  IconButton,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function GridItem({
  title,
  children,
  tooltip,
  link,
  ...props
}: PropsWithChildren<
  ComponentProps<typeof YStack> & {
    title: string;
    tooltip?: string;
    link?: string;
  }
>) {
  const openLink = useCallback(() => {
    if (link) {
      openUrlExternal(link);
    }
  }, [link]);
  return (
    <YStack
      p="$3"
      flexBasis="50%"
      $gtMd={{
        flexBasis: '33.33%',
      }}
      {...props}
    >
      <XStack gap="$1" mb="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {title}
        </SizableText>
        {tooltip ? (
          <Popover
            placement="top"
            title={title}
            renderTrigger={
              <IconButton
                iconColor="$iconSubdued"
                size="small"
                icon="InfoCircleOutline"
                variant="tertiary"
              />
            }
            renderContent={
              <Stack p="$5">
                <SizableText>{tooltip}</SizableText>
              </Stack>
            }
          />
        ) : null}
      </XStack>
      <XStack gap="$1" alignItems="center">
        <SizableText size="$bodyLgMedium">{children}</SizableText>
        {link ? (
          <Stack onPress={openLink} cursor="pointer">
            <Icon name="OpenOutline" color="$iconSubdued" size="$5" />
          </Stack>
        ) : null}
      </XStack>
    </YStack>
  );
}

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
import type { IEarnAction, IEarnText } from '@onekeyhq/shared/types/staking';

export function GridItem({
  title,
  description,
  actionIcon,
  tooltip,
}: {
  title: IEarnText;
  description?: IEarnText;
  actionIcon?: IEarnAction;
  tooltip?: IEarnText;
}) {
  const openLink = useCallback(() => {
    // if (link) {
    //   openUrlExternal(link);
    // }
  }, []);
  return (
    <YStack
      p="$3"
      flexBasis="50%"
      $gtMd={{
        flexBasis: '33.33%',
      }}
    >
      <XStack gap="$1" mb="$1">
        <SizableText size="$bodyMd" color={title.color || '$textSubdued'}>
          {title.text}
        </SizableText>
        {tooltip ? (
          <Popover
            placement="top"
            title={title.text}
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
        {description ? (
          <SizableText size="$bodyLgMedium" color={description.color}>
            {description.text}
          </SizableText>
        ) : null}

        {/* {link ? (
          <Stack onPress={openLink} cursor="pointer">
            <Icon name="OpenOutline" color="$iconSubdued" size="$5" />
          </Stack>
        ) : null} */}
      </XStack>
    </YStack>
  );
}

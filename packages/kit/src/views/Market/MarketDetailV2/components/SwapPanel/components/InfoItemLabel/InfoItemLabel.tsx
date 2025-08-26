import type { ReactNode } from 'react';
import { useMemo } from 'react';

import {
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

export const InfoItemLabel = ({
  title,
  questionMarkContent,
}: {
  title: string;
  questionMarkContent?: ReactNode;
}) => {
  const questionMarkComponent = useMemo(
    () => (
      <Popover
        placement="bottom"
        title={title}
        renderTrigger={
          <Icon
            name="InfoCircleOutline"
            size="$4"
            cursor="pointer"
            color="$iconSubdued"
          />
        }
        renderContent={
          <Stack px="$4" pb="$4">
            <SizableText size="$bodyMd" color="$text">
              {questionMarkContent}
            </SizableText>
          </Stack>
        }
      />
    ),
    [questionMarkContent, title],
  );
  return (
    <XStack alignItems="center">
      <SizableText
        userSelect="none"
        mr="$1"
        size="$bodyMd"
        color="$textSubdued"
      >
        {title}
      </SizableText>
      {questionMarkContent ? questionMarkComponent : null}
    </XStack>
  );
};

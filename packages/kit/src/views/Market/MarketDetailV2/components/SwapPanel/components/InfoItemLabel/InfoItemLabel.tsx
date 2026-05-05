import type { ReactNode } from 'react';
import { useMemo } from 'react';

import {
  Icon,
  Popover,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  useMedia,
} from '@onekeyhq/components';

export const InfoItemLabel = ({
  title,
  questionMarkContent,
}: {
  title: string;
  questionMarkContent?: ReactNode;
}) => {
  const { gtMd } = useMedia();
  const questionMarkComponent = useMemo(
    () =>
      gtMd ? (
        <Tooltip
          placement="bottom"
          renderTrigger={
            <Icon
              name="InfoCircleOutline"
              size="$4"
              cursor="default"
              color="$iconSubdued"
            />
          }
          renderContent={
            <SizableText size="$bodySm">{questionMarkContent}</SizableText>
          }
        />
      ) : (
        <Popover
          placement="bottom"
          title={title}
          renderTrigger={
            <Icon
              name="InfoCircleOutline"
              size="$4"
              cursor="default"
              color="$iconSubdued"
            />
          }
          renderContent={
            <Stack px="$2.5" py="$2">
              <SizableText size="$bodyMd" color="$text">
                {questionMarkContent}
              </SizableText>
            </Stack>
          }
        />
      ),
    [questionMarkContent, title, gtMd],
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

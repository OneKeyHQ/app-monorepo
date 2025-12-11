import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';

import {
  type ISizableTextProps,
  Icon,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';

interface ISwapCommonInfoItemProps {
  title: string;
  value?: string;
  valueComponent?: ReactNode;
  onPress?: () => void;
  questionMarkContent?: ReactNode;
  isLoading?: boolean;
  titleProps?: ISizableTextProps;
  valueProps?: ISizableTextProps;
}

const SwapCommonInfoItemTitleContent = ({
  title,
  questionMarkContent,
  titleProps,
}: {
  title: string;
  questionMarkContent?: ReactNode;
  titleProps?: ISizableTextProps;
}) => {
  const questionMarkComponent = useMemo(
    () => (
      <Popover
        title={title}
        renderTrigger={
          <Icon
            name="InfoCircleOutline"
            size="$3.5"
            cursor="pointer"
            color="$iconSubdued"
          />
        }
        renderContent={<Stack>{questionMarkContent}</Stack>}
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
        {...titleProps}
      >
        {title}
      </SizableText>
      {questionMarkContent ? questionMarkComponent : null}
    </XStack>
  );
};

const SwapCommonInfoItemTitleContentMemo = memo(SwapCommonInfoItemTitleContent);

const SwapCommonInfoItem = ({
  title,
  value,
  onPress,
  isLoading,
  valueComponent,
  questionMarkContent,
  titleProps,
  valueProps,
}: ISwapCommonInfoItemProps) => {
  const rightTrigger = useMemo(
    () => (
      <XStack
        userSelect="none"
        hoverStyle={{
          opacity: 0.5,
        }}
        alignItems="center"
        onPress={onPress}
        cursor={onPress ? 'pointer' : undefined}
      >
        {valueComponent || (
          <SizableText size="$bodyMdMedium" {...valueProps}>
            {value}
          </SizableText>
        )}
        {onPress ? (
          <Icon
            name="ChevronRightSmallOutline"
            mr="$-1"
            size="$5"
            color="$iconSubdued"
          />
        ) : null}
      </XStack>
    ),
    [onPress, value, valueComponent, valueProps],
  );

  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SwapCommonInfoItemTitleContentMemo
        title={title}
        questionMarkContent={questionMarkContent}
        titleProps={titleProps}
      />

      <XStack gap="$2">
        {isLoading ? (
          <Stack py={valueProps?.size === '$bodySmMedium' ? '$0' : '$1'}>
            <Skeleton h="$3" w="$24" />
          </Stack>
        ) : (
          rightTrigger
        )}
      </XStack>
    </XStack>
  );
};

export default memo(SwapCommonInfoItem);

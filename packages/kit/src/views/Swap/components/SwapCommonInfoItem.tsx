import type { ComponentProps, ReactNode } from 'react';
import { memo, useMemo } from 'react';

import {
  type ISizableTextProps,
  Icon,
  IconButton,
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
  containerProps?: ComponentProps<typeof XStack>;
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
        mountNativePortalBeforeOpen
        renderTrigger={
          <IconButton
            testID="swap-common-info-help"
            icon="InfoCircleOutline"
            iconSize="$3.5"
            iconProps={{ color: '$iconSubdued' }}
            accessibilityLabel={title}
            variant="tertiary"
            size="small"
            hotKey
            width="$3.5"
            height="$3.5"
            minHeight="$3.5"
            borderWidth={0}
            p={0}
            m={0}
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
  containerProps,
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
    <XStack
      justifyContent="space-between"
      alignItems="center"
      {...containerProps}
    >
      <SwapCommonInfoItemTitleContentMemo
        title={title}
        questionMarkContent={questionMarkContent}
        titleProps={titleProps}
      />

      <XStack gap="$2">
        {isLoading ? (
          <Stack {...containerProps}>
            <Skeleton h="$2" w="$24" />
          </Stack>
        ) : (
          rightTrigger
        )}
      </XStack>
    </XStack>
  );
};

export default memo(SwapCommonInfoItem);

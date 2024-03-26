import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import {
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
  questionMarkContent?: string;
  isLoading?: boolean;
  renderPopoverContent?: () => ReactNode;
  popoverOnOpenChange?: (open: boolean) => void;
}

const SwapCommonInfoItem = ({
  title,
  value,
  onPress,
  isLoading,
  valueComponent,
  questionMarkContent,
  renderPopoverContent,
  popoverOnOpenChange,
}: ISwapCommonInfoItemProps) => {
  const questionMarkComponent = useMemo(
    () => (
      <Popover
        title={title}
        renderTrigger={
          <IconButton
            variant="tertiary"
            size="small"
            icon="QuestionmarkOutline"
          />
        }
        renderContent={
          <SizableText
            p="$5"
            $gtMd={{
              size: '$bodyMd',
            }}
          >
            {questionMarkContent}
          </SizableText>
        }
      />
    ),
    [questionMarkContent, title],
  );

  const rightTrigger = useMemo(
    () => (
      <XStack
        userSelect="none"
        hoverStyle={{
          opacity: 0.5,
        }}
        alignItems="center"
      >
        {valueComponent || (
          <SizableText size="$bodyMdMedium">{value}</SizableText>
        )}
        {onPress || renderPopoverContent ? (
          <Icon
            name="ChevronRightSmallOutline"
            mr="$-1"
            size="$5"
            color="$iconSubdued"
          />
        ) : null}
      </XStack>
    ),
    [onPress, renderPopoverContent, value, valueComponent],
  );
  const popoverContent = useCallback(() => {
    if (renderPopoverContent) {
      return (
        <Popover
          renderTrigger={rightTrigger}
          renderContent={renderPopoverContent}
          title={title}
          keepChildrenMounted
          onOpenChange={popoverOnOpenChange}
        />
      );
    }
    return rightTrigger;
  }, [popoverOnOpenChange, renderPopoverContent, rightTrigger, title]);
  return (
    <XStack
      onPress={onPress}
      justifyContent="space-between"
      alignItems="center"
    >
      <XStack>
        <SizableText mr="$1" size="$bodyMd" color="$textSubdued">
          {title}
        </SizableText>
        {questionMarkContent ? questionMarkComponent : null}
      </XStack>

      <XStack space="$2">
        {isLoading ? (
          <Stack py="$1">
            <Skeleton h="$3" w="$24" />
          </Stack>
        ) : (
          popoverContent()
        )}
      </XStack>
    </XStack>
  );
};

export default SwapCommonInfoItem;

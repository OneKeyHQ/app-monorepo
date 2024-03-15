import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import {
  Icon,
  IconButton,
  Popover,
  SizableText,
  Skeleton,
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
        renderTrigger={<IconButton size="small" icon="QuestionmarkOutline" />}
        renderContent={<SizableText m="$2">{questionMarkContent}</SizableText>}
      />
    ),
    [questionMarkContent, title],
  );

  const rightTrigger = useMemo(
    () => (
      <XStack>
        {valueComponent || <SizableText>{value}</SizableText>}
        {onPress || renderPopoverContent ? (
          <Icon name="ChevronRightSmallOutline" />
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
        <SizableText mr="$1">{title}</SizableText>
        {questionMarkContent ? questionMarkComponent : null}
      </XStack>

      <XStack space="$2">
        {isLoading ? <Skeleton w="$20" /> : popoverContent()}
      </XStack>
    </XStack>
  );
};

export default SwapCommonInfoItem;

import type { ReactNode } from 'react';
import { useMemo } from 'react';

import {
  Icon,
  IconButton,
  Popover,
  SizableText,
  Skeleton,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

interface ISwapCommonInfoItemProps {
  title: string;
  value?: string;
  valueComponent?: ReactNode;
  onPress?: () => void;
  questionMarkContent?: string;
  isLoading?: boolean;
}

const SwapCommonInfoItem = ({
  title,
  value,
  onPress,
  isLoading,
  valueComponent,
  questionMarkContent,
}: ISwapCommonInfoItemProps) => {
  const questionMarkComponent = useMemo(
    () =>
      platformEnv.isNative ? (
        <Popover
          title={title}
          renderTrigger={<IconButton size="small" icon="QuestionmarkOutline" />}
          renderContent={<SizableText>{questionMarkContent}</SizableText>}
        />
      ) : (
        <Tooltip
          renderTrigger={<IconButton size="small" icon="QuestionmarkOutline" />}
          renderContent={<SizableText>{questionMarkContent}</SizableText>}
        />
      ),
    [questionMarkContent, title],
  );
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
        {isLoading ? (
          <Skeleton w="$20" />
        ) : (
          <>
            {valueComponent || <SizableText>{value}</SizableText>}
            {onPress && <Icon name="ChevronRightSmallOutline" />}
          </>
        )}
      </XStack>
    </XStack>
  );
};

export default SwapCommonInfoItem;

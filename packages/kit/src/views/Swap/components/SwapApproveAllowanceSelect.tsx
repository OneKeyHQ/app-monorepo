import { memo, useCallback } from 'react';

import type { ISelectItem } from '@onekeyhq/components';
import {
  Icon,
  Select,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';

interface ISwapApproveAllowanceSelectProps {
  onSelectAllowanceValue: (value: string) => void;
  onSelectOpenChange?: (open: boolean) => void;
  currentSelectAllowanceValue?: ISelectItem;
  selectItems: ISelectItem[];
  isLoading?: boolean;
}
const SwapApproveAllowanceSelect = ({
  onSelectAllowanceValue,
  currentSelectAllowanceValue,
  selectItems,
  onSelectOpenChange,
  isLoading,
}: ISwapApproveAllowanceSelectProps) => {
  const renderTrigger = useCallback(() => {
    if (isLoading)
      return (
        <Stack py="$1">
          <Skeleton h="$3" w="$24" />
        </Stack>
      );

    return (
      <XStack
        userSelect="none"
        hoverStyle={{
          opacity: 0.5,
        }}
      >
        <SizableText size="$bodyMdMedium">
          {currentSelectAllowanceValue?.label}
        </SizableText>
        <Icon
          size="$5"
          color="$iconSubdued"
          name="ChevronRightSmallOutline"
          mr="$-1"
        />
      </XStack>
    );
  }, [currentSelectAllowanceValue?.label, isLoading]);
  return (
    <XStack justifyContent="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        Authorization limit
      </SizableText>
      <Select
        placement="bottom-end"
        items={selectItems}
        value={currentSelectAllowanceValue?.value}
        onChange={(value: string) => {
          onSelectAllowanceValue(value);
        }}
        onOpenChange={onSelectOpenChange}
        title="Authorization limit"
        renderTrigger={renderTrigger}
      />
    </XStack>
  );
};

export default memo(SwapApproveAllowanceSelect);

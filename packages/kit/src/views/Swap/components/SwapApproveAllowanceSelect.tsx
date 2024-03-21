import { memo, useCallback, useState } from 'react';

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
  selectItems: ISelectItem[];
  isLoading?: boolean;
}
const SwapApproveAllowanceSelect = ({
  onSelectAllowanceValue,
  selectItems,
  isLoading,
}: ISwapApproveAllowanceSelectProps) => {
  const [currentAllowanceValue, setCurrentAllowanceValue] = useState<
    ISelectItem | undefined
  >(() => selectItems?.[0]);
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
          {currentAllowanceValue?.label}
        </SizableText>
        <Icon
          size="$5"
          color="$iconSubdued"
          name="ChevronRightSmallOutline"
          mr="$-1"
        />
      </XStack>
    );
  }, [currentAllowanceValue?.label, isLoading]);
  return (
    <XStack justifyContent="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        Authorization Limit
      </SizableText>
      <Select
        placement="bottom-end"
        items={selectItems}
        value={currentAllowanceValue?.value}
        onChange={(value: string) => {
          setCurrentAllowanceValue(
            selectItems?.find((item) => item.value === value),
          );
          onSelectAllowanceValue(value);
        }}
        title="Authorization Limit"
        renderTrigger={renderTrigger}
      />
    </XStack>
  );
};

export default memo(SwapApproveAllowanceSelect);

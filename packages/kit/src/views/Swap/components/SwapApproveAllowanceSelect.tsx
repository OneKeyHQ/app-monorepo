import { memo, useCallback, useState } from 'react';

import type { ISelectItem } from '@onekeyhq/components';
import {
  Icon,
  Select,
  SizableText,
  Skeleton,
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
  const renderTrigger = useCallback(
    () => (
      <XStack justifyContent="space-between">
        <SizableText>Authorization Limit</SizableText>

        <XStack>
          {isLoading && selectItems.length ? (
            <Skeleton w="$20" />
          ) : (
            <>
              <SizableText h="$5">{currentAllowanceValue?.label}</SizableText>
              <Icon size="$5" name="ChevronRightSmallOutline" />
            </>
          )}
        </XStack>
      </XStack>
    ),
    [currentAllowanceValue?.label, isLoading, selectItems.length],
  );
  return (
    <Select
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
  );
};

export default memo(SwapApproveAllowanceSelect);

import { memo, useCallback, useMemo, useState } from 'react';

import {
  ISelectItem,
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
        <SizableText>{'Authorization Limit'}</SizableText>
        <XStack>
          <SizableText h="$5">{currentAllowanceValue?.label}</SizableText>
          <Icon size="$5" name="ChevronRightSmallOutline" />
        </XStack>
      </XStack>
    ),
    [currentAllowanceValue],
  );
  return isLoading && selectItems.length ? (
    <Skeleton w="$20" />
  ) : (
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

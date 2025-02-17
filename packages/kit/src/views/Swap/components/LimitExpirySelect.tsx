import { memo, useCallback } from 'react';

import type { ISelectItem } from '@onekeyhq/components';
import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';

interface ISwapLimitExpirySelectProps {
  onSelectExpiryValue: (value: ISelectItem) => void;
  currentSelectExpiryValue?: ISelectItem;
  selectItems: ISelectItem[];
}
const SwapLimitExpirySelect = ({
  onSelectExpiryValue,
  currentSelectExpiryValue,
  selectItems,
}: ISwapLimitExpirySelectProps) => {
  const renderTrigger = useCallback(
    () => (
      <XStack
        userSelect="none"
        hoverStyle={{
          opacity: 0.5,
        }}
      >
        <SizableText size="$bodyMdMedium">
          {currentSelectExpiryValue?.label}
        </SizableText>
        <Icon
          size="$5"
          color="$iconSubdued"
          name="ChevronRightSmallOutline"
          mr="$-1"
        />
      </XStack>
    ),
    [currentSelectExpiryValue?.label],
  );
  return (
    <XStack justifyContent="space-between">
      <SizableText size="$bodyMd" color="$textSubdued" userSelect="none">
        Order expires in
      </SizableText>
      <Select
        placement="bottom-end"
        items={selectItems}
        value={currentSelectExpiryValue?.value}
        onChange={(value: string) => {
          const selectedItem = selectItems.find((item) => item.value === value);
          if (selectedItem) {
            onSelectExpiryValue(selectedItem);
          }
        }}
        title="Expiry"
        renderTrigger={renderTrigger}
      />
    </XStack>
  );
};

export default memo(SwapLimitExpirySelect);

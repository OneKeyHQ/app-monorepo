import { useCallback } from 'react';

import { SegmentControl, SizableText, YStack } from '@onekeyhq/components';
import type { IFeeSelectorItem } from '@onekeyhq/shared/types/fee';

type IProps = {
  feeSelectorItems: IFeeSelectorItem[];
  selectedIndex: number;
  onSelect: (presetIndex: number) => void;
};

function BulkSendFeeSelector({
  feeSelectorItems,
  selectedIndex,
  onSelect,
}: IProps) {
  const handleChange = useCallback(
    (value: string | number) => {
      onSelect(Number(value));
    },
    [onSelect],
  );

  if (feeSelectorItems.length === 0) {
    return null;
  }

  return (
    <YStack>
      <SegmentControl
        fullWidth
        value={selectedIndex}
        onChange={handleChange}
        options={feeSelectorItems.map((item, index) => ({
          label: (
            <SizableText
              color={selectedIndex === index ? '$textInteractive' : '$text'}
              size="$bodyMdMedium"
              textAlign="center"
            >
              {item.label}
            </SizableText>
          ),
          value: index,
        }))}
      />
    </YStack>
  );
}

export default BulkSendFeeSelector;

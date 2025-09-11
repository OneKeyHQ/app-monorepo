import { memo } from 'react';

import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';
import type { ISelectItem } from '@onekeyhq/components';

interface IOrderTypeSelectorProps {
  value: 'market' | 'limit';
  onChange: (value: 'market' | 'limit') => void;
  disabled?: boolean;
}

const orderTypeOptions: ISelectItem[] = [
  { label: 'Market', value: 'market' },
  { label: 'Limit', value: 'limit' },
];

export const OrderTypeSelector = memo<IOrderTypeSelectorProps>(
  // eslint-disable-next-line react/prop-types
  ({ value, onChange, disabled = false }) => {
    return (
      <Select
        items={orderTypeOptions}
        value={value}
        onChange={onChange}
        disabled={disabled}
        title="Order Type"
        renderTrigger={({ onPress, label, disabled: disabledTrigger }) => (
          <XStack
            cursor="pointer"
            onPress={onPress}
            disabled={disabledTrigger}
            height={30}
            bg="$bgSubdued"
            borderRadius="$2"
            alignItems="center"
            justifyContent="space-between"
            px="$3"
            flex={1}
          >
            <SizableText size="$bodyMdMedium">{label}</SizableText>
            <Icon
              name="ChevronTriangleDownSmallOutline"
              color="$icon"
              size="$5"
            />
          </XStack>
        )}
        placement="bottom-start"
        floatingPanelProps={{
          width: 120,
        }}
      />
    );
  },
);

OrderTypeSelector.displayName = 'OrderTypeSelector';

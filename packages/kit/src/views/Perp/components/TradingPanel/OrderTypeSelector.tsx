import { memo } from 'react';

import {
  type ISegmentControlProps,
  SegmentControl,
} from '@onekeyhq/components';

interface IOrderTypeSelectorProps {
  value: 'market' | 'limit';
  onChange: (value: 'market' | 'limit') => void;
  disabled?: boolean;
}

export const OrderTypeSelector = memo<IOrderTypeSelectorProps>(
  // eslint-disable-next-line react/prop-types
  ({ value, onChange, disabled = false }) => {
    return (
      <SegmentControl
        value={value}
        onChange={onChange as ISegmentControlProps['onChange']}
        disabled={disabled}
        options={[
          { label: 'Market', value: 'market' },
          { label: 'Limit', value: 'limit' },
        ]}
      />
    );
  },
);

OrderTypeSelector.displayName = 'OrderTypeSelector';

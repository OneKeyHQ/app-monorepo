import { useCallback, useMemo } from 'react';

import { SegmentControl } from '@onekeyhq/components';

import type { IBulkExportHistoryDateRangeSelectorProps } from './BulkExportHistoryDateRangeSelector.types';

function BulkExportHistoryDateRangeSelector({
  value,
  options,
  onChange,
  disabled,
  testID,
}: IBulkExportHistoryDateRangeSelectorProps) {
  const resolvedOptions = useMemo(
    () =>
      disabled
        ? options.map((option) => ({ ...option, disabled: true }))
        : options,
    [disabled, options],
  );
  const handleChange = useCallback(
    (nextValue: string | number) => {
      const nextOption = options.find((option) => option.value === nextValue);
      if (!disabled && !nextOption?.disabled) {
        onChange(nextValue);
      }
    },
    [disabled, onChange, options],
  );

  return (
    <SegmentControl
      fullWidth
      value={value}
      options={resolvedOptions}
      onChange={handleChange}
      testID={testID}
    />
  );
}

export default BulkExportHistoryDateRangeSelector;

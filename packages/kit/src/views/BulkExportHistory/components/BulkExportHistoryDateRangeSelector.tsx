import { useCallback, useMemo } from 'react';

import { SegmentControl, useMedia } from '@onekeyhq/components';

import BulkExportHistoryDateRangeSelect from './BulkExportHistoryDateRangeSelect';

import type { IBulkExportHistoryDateRangeSelectorProps } from './BulkExportHistoryDateRangeSelector.types';

function BulkExportHistoryDateRangeSelector({
  value,
  options,
  onChange,
  disabled,
  testID,
}: IBulkExportHistoryDateRangeSelectorProps) {
  const { md } = useMedia();
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

  if (md) {
    return (
      <BulkExportHistoryDateRangeSelect
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        testID={testID}
      />
    );
  }

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

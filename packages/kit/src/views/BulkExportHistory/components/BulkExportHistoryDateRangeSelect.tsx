import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, Icon, Select, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IBulkExportHistoryDateRangeSelectorProps } from './BulkExportHistoryDateRangeSelector.types';

function BulkExportHistoryDateRangeSelect({
  value,
  options,
  onChange,
  disabled,
  testID,
}: IBulkExportHistoryDateRangeSelectorProps) {
  const intl = useIntl();
  const resolvedOptions = useMemo(
    () =>
      disabled
        ? options.map((option) => ({ ...option, disabled: true }))
        : options,
    [disabled, options],
  );
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );
  const handleChange = useCallback(
    (nextValue: string | number) => {
      const nextOption = resolvedOptions.find(
        (option) => option.value === nextValue,
      );
      if (nextOption && !nextOption.disabled) {
        onChange(nextValue);
      }
    },
    [onChange, resolvedOptions],
  );

  return (
    <Select
      testID={testID}
      title={intl.formatMessage({
        id: ETranslations.global_select_date_range,
      })}
      items={resolvedOptions}
      value={value}
      disabled={disabled}
      onChange={handleChange}
      renderTrigger={() => (
        <Button
          testID={testID}
          variant="tertiary"
          size="medium"
          childrenAsText={false}
          disabled={disabled}
          width="100%"
          minHeight="$11"
          px="$3.5"
          py="$2.5"
          mx="$0"
          my="$0"
          borderWidth={1}
          borderColor="$borderStrong"
          borderRadius="$3"
          borderCurve="continuous"
          alignItems="center"
          justifyContent="space-between"
          gap="$2"
          userSelect="none"
          opacity={1}
          pressStyle={disabled ? undefined : { bg: '$bgActive' }}
        >
          <SizableText flex={1} minWidth={0} size="$bodyLg">
            {selectedOption?.label}
          </SizableText>
          <Icon
            flexShrink={0}
            name="ChevronDownSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        </Button>
      )}
    />
  );
}

export default BulkExportHistoryDateRangeSelect;

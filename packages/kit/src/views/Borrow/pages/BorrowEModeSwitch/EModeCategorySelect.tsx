import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { type IEModeRow, buildEModeSelectDescription } from './emodeUtils';

export function EModeCategorySelect({
  rows,
  currentEModeId,
  value,
  disabled,
  onChange,
}: {
  rows: IEModeRow[];
  currentEModeId: number;
  value: number | null;
  disabled?: boolean;
  onChange: (eModeId: number) => void;
}) {
  const intl = useIntl();
  const descriptions = useMemo(
    () =>
      new Map(
        rows.map((row) => [
          row.eModeId,
          buildEModeSelectDescription({
            row,
            currentEModeId,
            currentText: intl.formatMessage({
              id: ETranslations.global_current,
            }),
            offText: intl.formatMessage({
              id: ETranslations.defi_emode_off_desc,
            }),
            formatMaxLtv: (ltv) =>
              intl.formatMessage(
                { id: ETranslations.defi_emode_max_ltv },
                { ltv },
              ),
            needsActionText: intl.formatMessage({
              id: ETranslations.defi_emode_need_action,
            }),
          }),
        ]),
      ),
    [currentEModeId, intl, rows],
  );
  const items = useMemo(
    () =>
      rows.map((row) => ({
        label: row.displayLabel,
        value: row.eModeId,
        description: descriptions.get(row.eModeId) ?? '',
        disabled: row.disabled,
      })),
    [descriptions, rows],
  );
  const selectedRow = rows.find((row) => row.eModeId === value);
  const selectedDescription =
    value === null ? '' : (descriptions.get(value) ?? '');

  return (
    <Select
      testID="borrow-e-mode-category-select"
      title={intl.formatMessage({
        id: ETranslations.defi_emode_select_category,
      })}
      items={items}
      value={value ?? undefined}
      disabled={disabled}
      onChange={(next) => {
        if (typeof next === 'number') {
          onChange(next);
        }
      }}
      renderTrigger={({ onPress }) => (
        <XStack
          minHeight="$12"
          px="$3.5"
          py="$2.5"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$3"
          ai="center"
          onPress={onPress}
        >
          <YStack flex={1} minWidth={0}>
            <SizableText size="$bodyLgMedium" numberOfLines={1}>
              {selectedRow?.displayLabel}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {selectedDescription}
            </SizableText>
          </YStack>
          <Icon
            flexShrink={0}
            name="ChevronDownSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        </XStack>
      )}
    />
  );
}

import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

import { type IEModeRow, buildEModeSelectDescription } from './emodeUtils';

export function EModeCategorySelect({
  rows,
  eModeStatus,
  currentEModeId,
  value,
  disabled,
  onChange,
}: {
  rows: IEModeRow[];
  eModeStatus: IBorrowEModeStatus;
  currentEModeId: number;
  value: number | null;
  disabled?: boolean;
  onChange: (eModeId: number) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const selectedRow = rows.find((row) => row.eModeId === value);
  const selectedDescription = useMemo(() => {
    if (!selectedRow) {
      return '';
    }
    return buildEModeSelectDescription({
      row: selectedRow,
      currentEModeId,
      currentText: intl.formatMessage({ id: ETranslations.global_current }),
      offText: intl.formatMessage({ id: ETranslations.defi_emode_off_desc }),
      formatMaxLtv: (ltv) =>
        intl.formatMessage({ id: ETranslations.defi_emode_max_ltv }, { ltv }),
      needsActionText: intl.formatMessage({
        id: ETranslations.defi_emode_need_action,
      }),
    });
  }, [currentEModeId, intl, selectedRow]);

  // A pushed modal page instead of a Select popover: the picker rows carry two
  // token groups each, and Select hard-codes its desktop panel to $56 (224px).
  // Inside a modal stack this is `push`, not `pushModal` — the screen slides in
  // as a full-size page in the same modal card.
  const openCategoryPicker = useCallback(() => {
    if (disabled) {
      return;
    }
    navigation.push(EModalStakingRoutes.BorrowEModeCategorySelect, {
      eModeStatus,
      selectedEModeId: value,
      onSelect: onChange,
    });
  }, [disabled, eModeStatus, navigation, onChange, value]);

  return (
    <XStack
      testID="borrow-e-mode-category-select"
      role="button"
      minHeight="$12"
      px="$3.5"
      py="$2.5"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      ai="center"
      opacity={disabled ? 0.5 : 1}
      {...(disabled
        ? {}
        : {
            onPress: openCategoryPicker,
            cursor: 'pointer',
            hoverStyle: { bg: '$bgHover' },
            pressStyle: { bg: '$bgActive' },
          })}
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
        name="ChevronRightSmallOutline"
        size="$5"
        color="$iconSubdued"
      />
    </XStack>
  );
}

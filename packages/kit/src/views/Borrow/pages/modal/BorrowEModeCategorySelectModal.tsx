import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useBorrowEModeStatus } from '@onekeyhq/kit/src/views/Borrow/hooks/useBorrowEModeStatus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';

import { buildCategoryRowActivationProps } from '../BorrowEModeSwitch/categoryRowActivation';
import {
  type IEModeRow,
  buildEModeRowSubtitle,
  buildEModeRows,
} from '../BorrowEModeSwitch/emodeUtils';

function EModeCategoryRow({
  row,
  currentEModeId,
  isSelected,
  onPress,
}: {
  row: IEModeRow;
  currentEModeId: number;
  isSelected: boolean;
  onPress: (eModeId: number) => void;
}) {
  const intl = useIntl();

  const subtitle = buildEModeRowSubtitle({
    row,
    offText: intl.formatMessage({ id: ETranslations.defi_emode_off_desc }),
    formatMaxLtv: (ltv) =>
      intl.formatMessage({ id: ETranslations.defi_emode_max_ltv }, { ltv }),
    needsActionText: intl.formatMessage({
      id: ETranslations.defi_emode_need_action,
    }),
  });

  return (
    <XStack
      testID={`borrow-e-mode-category-row-${row.eModeId}`}
      ai="center"
      gap="$3"
      px="$5"
      py="$3"
      opacity={row.disabled ? 0.5 : 1}
      {...buildCategoryRowActivationProps({
        disabled: row.disabled,
        onActivate: () => onPress(row.eModeId),
        selected: isSelected,
        outlineOffset: -2,
      })}
    >
      <YStack flex={1} minWidth={0}>
        <XStack ai="center" gap="$2">
          <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
            {row.displayLabel}
          </SizableText>
          {row.eModeId === currentEModeId ? (
            <Badge badgeType="info" badgeSize="sm">
              {intl.formatMessage({ id: ETranslations.global_current })}
            </Badge>
          ) : null}
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {subtitle}
        </SizableText>
      </YStack>
      {isSelected ? (
        <Icon
          flexShrink={0}
          name="CheckLargeOutline"
          size="$5"
          color="$iconActive"
        />
      ) : (
        <Stack flexShrink={0} w="$5" h="$5" />
      )}
    </XStack>
  );
}

export default function BorrowEModeCategorySelectModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.BorrowEModeCategorySelect
  >();
  const {
    networkId,
    provider,
    marketAddress,
    accountId,
    selectedEModeId,
    onSelect,
  } = route.params;

  // Same scope key as the switch page that pushed this screen, so this reads
  // straight out of the cache and then keeps following it.
  const { eModeStatus } = useBorrowEModeStatus({
    networkId,
    provider,
    marketAddress,
    accountId,
    enabled: !!accountId,
  });

  const rows = useMemo(
    () =>
      eModeStatus
        ? buildEModeRows(
            eModeStatus,
            intl.formatMessage({ id: ETranslations.defi_emode_off }),
          )
        : [],
    [eModeStatus, intl],
  );

  const handleSelect = useCallback(
    (eModeId: number) => {
      onSelect?.(eModeId);
      navigation.pop();
    },
    [navigation, onSelect],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.defi_emode_select_category,
        })}
      />
      <Page.Body>
        <YStack py="$2">
          {rows.map((row) => (
            <EModeCategoryRow
              key={row.eModeId}
              row={row}
              currentEModeId={eModeStatus?.eModeId ?? 0}
              isSelected={row.eModeId === selectedEModeId}
              onPress={handleSelect}
            />
          ))}
        </YStack>
      </Page.Body>
    </Page>
  );
}

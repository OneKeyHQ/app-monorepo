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
  useMedia,
} from '@onekeyhq/components';
import { TokenGroup } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import type { IBorrowEModeAsset } from '@onekeyhq/shared/types/staking';

import {
  type IEModeRow,
  buildEModeRowSubtitle,
  buildEModeRows,
} from '../BorrowEModeSwitch/emodeUtils';

const EMPTY_CAPABILITY = '-';

function CapabilityRow({
  label,
  assets,
  maxVisible,
}: {
  label: string;
  assets: IBorrowEModeAsset[];
  maxVisible: number;
}) {
  return (
    <XStack ai="center" gap="$2" minWidth={0} maxWidth="100%">
      {/* Only this label can give ground: at 320px the Russian "borrowable"
          copy plus a group that spills into a +N badge is 19px wider than the
          row, and shrinking it costs ~5px of one word instead of pushing the
          badge outside the card. */}
      <SizableText
        size="$bodySm"
        color="$textSubdued"
        numberOfLines={1}
        flexShrink={1}
      >
        {label}
      </SizableText>
      {assets.length ? (
        <TokenGroup
          size="xs"
          flexShrink={0}
          maxVisible={maxVisible}
          tokens={assets.map((asset) => ({
            tokenImageUri: asset.token.logoURI,
          }))}
        />
      ) : (
        // An explicit "none" so a collateral-only category cannot be read as
        // missing data.
        <SizableText size="$bodySm" color="$textDisabled">
          {EMPTY_CAPABILITY}
        </SizableText>
      )}
    </XStack>
  );
}

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
  const { gtMd } = useMedia();

  const subtitle = buildEModeRowSubtitle({
    row,
    offText: intl.formatMessage({ id: ETranslations.defi_emode_off_desc }),
    formatMaxLtv: (ltv) =>
      intl.formatMessage({ id: ETranslations.defi_emode_max_ltv }, { ltv }),
    needsActionText: intl.formatMessage({
      id: ETranslations.defi_emode_need_action,
    }),
  });

  const { collateral, borrowable } = useMemo(() => {
    const assets = row.assets ?? [];
    return {
      collateral: assets.filter((asset) => asset.boostedLTV),
      borrowable: assets.filter((asset) => asset.borrowable),
    };
  }, [row.assets]);

  // The Russian "borrowable" label alone measures ~150px at $bodySm, so the
  // label + token group pair cannot share a phone row with the category name.
  // Wide windows keep it on the right; phones drop it under the subtitle.
  const capabilities = row.isOff ? null : (
    <YStack
      gap="$1"
      flexShrink={0}
      ai={gtMd ? 'flex-end' : 'flex-start'}
      {...(gtMd ? {} : { mt: '$2', w: '100%' })}
    >
      <CapabilityRow
        label={intl.formatMessage({ id: ETranslations.defi_collateral })}
        assets={collateral}
        maxVisible={gtMd ? 4 : 3}
      />
      <CapabilityRow
        label={intl.formatMessage({ id: ETranslations.defi_borrowable })}
        assets={borrowable}
        maxVisible={gtMd ? 4 : 3}
      />
    </YStack>
  );

  return (
    <XStack
      testID={`borrow-e-mode-category-row-${row.eModeId}`}
      ai={gtMd ? 'center' : 'flex-start'}
      gap="$3"
      px="$5"
      py="$3"
      opacity={row.disabled ? 0.5 : 1}
      {...(row.disabled
        ? {}
        : {
            onPress: () => onPress(row.eModeId),
            cursor: 'pointer',
            hoverStyle: { bg: '$bgHover' },
            pressStyle: { bg: '$bgActive' },
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
        {gtMd ? null : capabilities}
      </YStack>
      {gtMd ? capabilities : null}
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
  const { eModeStatus, selectedEModeId, onSelect } = route.params;

  const rows = useMemo(
    () =>
      buildEModeRows(
        eModeStatus,
        intl.formatMessage({ id: ETranslations.defi_emode_off }),
      ),
    [eModeStatus, intl],
  );

  const handleSelect = useCallback(
    (eModeId: number) => {
      onSelect(eModeId);
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
              currentEModeId={eModeStatus.eModeId ?? 0}
              isSelected={row.eModeId === selectedEModeId}
              onPress={handleSelect}
            />
          ))}
        </YStack>
      </Page.Body>
    </Page>
  );
}

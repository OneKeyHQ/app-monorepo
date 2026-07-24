import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { InfoIcon } from '@onekeyhq/kit/src/components/InfoIcon';
import type { ITableColumn } from '@onekeyhq/kit/src/components/ListView/TableList';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { BorrowTableList } from '@onekeyhq/kit/src/views/Borrow/components/BorrowTableList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowEModeAsset } from '@onekeyhq/shared/types/staking';

import type { IEModeRow } from './emodeUtils';

function CapabilityBadge({
  available,
  accessibilityLabel,
}: {
  available: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Stack
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      <Icon
        name={available ? 'Checkmark2SmallOutline' : 'MinusSmallOutline'}
        size="$5"
        w="$5"
        h="$5"
        br="$1"
        bg={available ? '$bgSuccess' : '$bgSubdued'}
        color={available ? '$iconSuccess' : '$iconSubdued'}
      />
    </Stack>
  );
}

function CapabilityHeader({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <XStack ai="center" jc="center" gap="$0.5" minWidth={0}>
      <SizableText
        size="$bodySmMedium"
        color="$textSubdued"
        minWidth={0}
        numberOfLines={1}
      >
        {label}
      </SizableText>
      <InfoIcon size="$4" tooltip={tooltip} />
    </XStack>
  );
}

export function EModeAssetsTable({ row }: { row: IEModeRow }) {
  const intl = useIntl();
  const columns = useMemo<ITableColumn<IBorrowEModeAsset>[]>(
    () => [
      {
        key: 'asset',
        label: intl.formatMessage({ id: ETranslations.global_asset }),
        flex: 1,
        minWidth: 0,
        render: (asset) => (
          <XStack ai="center" gap="$2" flex={1} minWidth={0}>
            <Stack flexShrink={0}>
              <Token size="md" tokenImageUri={asset.token.logoURI} />
            </Stack>
            <SizableText
              size="$bodyMdMedium"
              flex={1}
              minWidth={0}
              numberOfLines={1}
            >
              {asset.token.symbol}
            </SizableText>
          </XStack>
        ),
      },
      {
        key: 'boostLtv',
        flex: '0 1 auto',
        minWidth: 76,
        maxWidth: 104,
        align: 'center',
        renderHeader: () => (
          <CapabilityHeader
            label={intl.formatMessage({
              id: ETranslations.defi_max_ltv,
            })}
            tooltip={intl.formatMessage({
              id: ETranslations.defi_emode_collateral_capability__tooltip,
            })}
          />
        ),
        render: (asset) => (
          <CapabilityBadge
            available={asset.boostedLTV}
            accessibilityLabel={[
              asset.token.symbol,
              intl.formatMessage({ id: ETranslations.defi_max_ltv }),
              intl.formatMessage({
                id: asset.boostedLTV
                  ? ETranslations.global_available
                  : ETranslations.global_not_available,
              }),
            ].join(', ')}
          />
        ),
      },
      {
        key: 'borrowable',
        flex: '0 1 auto',
        minWidth: 76,
        maxWidth: 104,
        align: 'center',
        renderHeader: () => (
          <CapabilityHeader
            label={intl.formatMessage({ id: ETranslations.defi_borrowable })}
            tooltip={intl.formatMessage({
              id: ETranslations.defi_emode_borrow_capability__tooltip,
            })}
          />
        ),
        render: (asset) => (
          <CapabilityBadge
            available={asset.borrowable}
            accessibilityLabel={intl.formatMessage(
              {
                id: asset.borrowable
                  ? ETranslations.defi_emode_can_borrow__a11y
                  : ETranslations.defi_emode_cannot_borrow__a11y,
              },
              { symbol: asset.token.symbol },
            )}
          />
        ),
      },
    ],
    [intl],
  );

  return (
    <YStack gap="$3">
      <SizableText size="$headingSm">
        {intl.formatMessage({
          id: ETranslations.defi_emode_supported_assets,
        })}
      </SizableText>
      {row.isOff ? (
        <Alert
          type="default"
          title={intl.formatMessage({
            id: ETranslations.defi_emode_off_assets__desc,
          })}
        />
      ) : (
        <BorrowTableList<IBorrowEModeAsset>
          columns={columns}
          data={row.assets ?? []}
          emptyContent={intl.formatMessage({
            id: ETranslations.defi_emode_no_supported_assets,
          })}
          listProps={{
            keyExtractor: (asset) => asset.reserveAddress,
            rowGap: '$2',
            headerProps: {
              px: '$1.5',
              mx: '$0',
            },
            listItemProps: {
              px: '$1.5',
              mx: '$0',
            },
          }}
        />
      )}
    </YStack>
  );
}

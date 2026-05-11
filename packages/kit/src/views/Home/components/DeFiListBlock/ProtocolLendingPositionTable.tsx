import { Fragment, memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ProtocolAssetValue } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionSection';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ILocalizedProtocolPositionItem } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// Lending positions keep the original row-section shape (Supplied / Borrowed
// / Rewards) because they are the only category that legitimately uses more
// than one asset bucket. The leftmost column is dual-purpose: it shows the
// section title on the header row and the token logo+symbol on data rows
// underneath. Column widths are absolute percentages so an empty cell never
// collapses the header / data row out of alignment on web.
//
// The Supplied section's leftmost header is overridden to "Positions" so
// it parallels ProtocolUnifiedTable's first column — "Supplied" reads as
// jargon next to plain language like "Borrowed" / "Rewards", and the
// asset rows below already convey the supplied semantic via the section
// being grouped with Borrowed / Rewards in the same lending block.
// Borrowed and Rewards section titles stay as-is because they are the
// terms users actually scan for.

// Mirrors the unified table's first-column width so Lending /
// Staking / LP / Yield tables in the same protocol card all begin their
// data columns at the same x-coordinate. Keep these two constants in
// sync — `POSITION_COLUMN_WIDTH` in ProtocolUnifiedTable.tsx.
const ASSET_COLUMN_WIDTH = 240;
const BALANCE_FLEX = 1.5;
const VALUE_FLEX = 1;

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

type IProtocolLendingPositionTableProps = {
  position: ILocalizedProtocolPositionItem;
  currencySymbol: string;
  priceUnavailableLabel: string;
};

const ProtocolLendingPositionTable = memo(
  ({
    position,
    currencySymbol,
    priceUnavailableLabel,
  }: IProtocolLendingPositionTableProps) => {
    const intl = useIntl();
    const labels = useMemo(
      () => ({
        // Replaces section.title for the Supplied section; matches the
        // first-column label used by ProtocolUnifiedTable.
        position: intl.formatMessage({ id: ETranslations.earn_positions }),
        balance: intl.formatMessage({ id: ETranslations.global_balance }),
        value: intl.formatMessage({ id: ETranslations.global_value }),
        poolNameTitle: intl.formatMessage({
          id: ETranslations.wallet_defi_position_name_popover_title,
        }),
      }),
      [intl],
    );

    const sections = position.sections.filter((s) => s.assets.length > 0);
    const poolDisplayName = position.poolName?.trim();
    const poolFullName = position.poolFullName || poolDisplayName;

    return (
      <YStack>
        {poolDisplayName ? (
          <Stack mx="$5" px="$2" pt="$1" pb="$0.5">
            <Popover
              hoverable
              placement="top"
              title={labels.poolNameTitle}
              renderTrigger={
                <SizableText
                  size="$bodySmMedium"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {poolDisplayName}
                </SizableText>
              }
              renderContent={
                <Stack px="$4" py="$2">
                  <SizableText size="$bodyLgMedium">{poolFullName}</SizableText>
                </Stack>
              }
            />
          </Stack>
        ) : null}
        {sections.map((section, sectionIndex) => (
          <Fragment key={section.key}>
            <XStack
              mx="$5"
              px="$2"
              py="$2"
              mt={sectionIndex === 0 ? '$0' : '$2'}
              alignItems="center"
              bg="$bgSubdued"
            >
              <Stack width={ASSET_COLUMN_WIDTH} flexShrink={0} minWidth={0}>
                <SizableText size="$headingXs" color="$textSubdued">
                  {section.assetType === 'supplied'
                    ? labels.position
                    : section.title}
                </SizableText>
              </Stack>
              <Stack flex={BALANCE_FLEX} minWidth={0}>
                <SizableText size="$headingXs" color="$textSubdued">
                  {labels.balance}
                </SizableText>
              </Stack>
              <Stack flex={VALUE_FLEX} minWidth={0} alignItems="flex-end">
                <SizableText size="$headingXs" color="$textSubdued">
                  {labels.value}
                </SizableText>
              </Stack>
            </XStack>
            {section.assets.map((asset, assetIndex) => (
              <XStack
                key={`${section.key}-${asset.address}-${assetIndex}`}
                mx="$5"
                px="$2"
                py="$2"
                alignItems="center"
                minHeight={44}
              >
                <XStack
                  width={ASSET_COLUMN_WIDTH}
                  flexShrink={0}
                  minWidth={0}
                  alignItems="center"
                  gap="$2"
                >
                  <Token
                    size="xs"
                    tokenImageUri={asset.meta?.logoUrl}
                    bg="$bgStrong"
                  />
                  <SizableText
                    size="$bodyMdMedium"
                    numberOfLines={1}
                    flex={1}
                    minWidth={0}
                  >
                    {asset.symbol}
                  </SizableText>
                </XStack>
                <Stack flex={BALANCE_FLEX} minWidth={0}>
                  <NumberSizeableTextWrapper
                    hideValue
                    size="$bodyMd"
                    formatter="balance"
                    formatterOptions={{ tokenSymbol: asset.symbol }}
                    numberOfLines={1}
                    fontVariant={TABULAR_NUMS}
                  >
                    {asset.amount}
                  </NumberSizeableTextWrapper>
                </Stack>
                <Stack flex={VALUE_FLEX} minWidth={0} alignItems="flex-end">
                  <ProtocolAssetValue
                    value={asset.value}
                    size="$bodyMdMedium"
                    currencySymbol={currencySymbol}
                    priceUnavailableLabel={priceUnavailableLabel}
                    textAlign="right"
                    numberOfLines={1}
                    fontVariant={TABULAR_NUMS}
                  />
                </Stack>
              </XStack>
            ))}
          </Fragment>
        ))}
      </YStack>
    );
  },
);

ProtocolLendingPositionTable.displayName = 'ProtocolLendingPositionTable';

export { ProtocolLendingPositionTable };

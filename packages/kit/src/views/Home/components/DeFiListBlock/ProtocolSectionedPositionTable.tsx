import { Fragment, memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { ProtocolValueCell } from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ILocalizedProtocolPositionItem } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ProtocolAssetBalanceText } from './ProtocolAssetBalanceText';
import {
  BALANCE_FLEX_WITHOUT_REWARDS,
  POSITION_COLUMN_WIDTH,
  USD_FLEX_WITHOUT_REWARDS,
} from './ProtocolUnifiedTable';

// Sectioned positions keep Supplied / Borrowed / Rewards as labelled
// segments so the user can tell what they own vs owe vs earned. Used
// for lending and for non-lending positions whose payload carries debts
// (leveraged farming etc.) — the unified table has no Borrowed column,
// so debt-bearing positions are routed here by buildProtocolCategoryGroups.
//
// No per-position header: upstream poolName values are almost always
// redundant with the protocol name (card header) or the category Badge
// directly above this block, so a header line just stacks the same info
// twice. Sibling positions in a sectioned group are separated by the
// parent YStack's gap.
//
// The Supplied section's leftmost header is overridden to "Positions" so
// it parallels ProtocolUnifiedTable's first column — "Supplied" reads as
// jargon next to plain language like "Borrowed" / "Rewards", and the
// asset rows below already convey the supplied semantic via the section
// being grouped with Borrowed / Rewards in the same block. Borrowed and
// Rewards section titles stay as-is because they are the terms users
// actually scan for.

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

type IProtocolSectionedPositionTableProps = {
  position: ILocalizedProtocolPositionItem;
  currencySymbol: string;
  priceUnavailableLabel: string;
};

const ProtocolSectionedPositionTable = memo(
  ({
    position,
    currencySymbol,
    priceUnavailableLabel,
  }: IProtocolSectionedPositionTableProps) => {
    const intl = useIntl();
    const labels = useMemo(
      () => ({
        position: intl.formatMessage({ id: ETranslations.earn_positions }),
        balance: intl.formatMessage({ id: ETranslations.global_balance }),
        value: intl.formatMessage({ id: ETranslations.global_value }),
      }),
      [intl],
    );

    const sections = position.sections.filter((s) => s.assets.length > 0);

    return (
      <YStack>
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
              <Stack width={POSITION_COLUMN_WIDTH} flexShrink={0} minWidth={0}>
                <SizableText size="$headingXs" color="$textSubdued">
                  {section.assetType === 'supplied'
                    ? labels.position
                    : section.title}
                </SizableText>
              </Stack>
              <Stack flex={BALANCE_FLEX_WITHOUT_REWARDS} minWidth={0}>
                <SizableText size="$headingXs" color="$textSubdued">
                  {labels.balance}
                </SizableText>
              </Stack>
              <Stack
                flex={USD_FLEX_WITHOUT_REWARDS}
                minWidth={0}
                alignItems="flex-end"
              >
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
                  width={POSITION_COLUMN_WIDTH}
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
                <Stack flex={BALANCE_FLEX_WITHOUT_REWARDS} minWidth={0}>
                  <ProtocolAssetBalanceText
                    asset={asset}
                    currencySymbol={currencySymbol}
                    priceUnavailableLabel={priceUnavailableLabel}
                  />
                </Stack>
                <Stack
                  flex={USD_FLEX_WITHOUT_REWARDS}
                  minWidth={0}
                  alignItems="flex-end"
                >
                  <ProtocolValueCell
                    value={asset.value}
                    currencySymbol={currencySymbol}
                    priceUnavailableLabel={priceUnavailableLabel}
                    size="$bodyMdMedium"
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

ProtocolSectionedPositionTable.displayName = 'ProtocolSectionedPositionTable';

export { ProtocolSectionedPositionTable };

import { Fragment, memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
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

const COLUMN_WIDTHS = {
  asset: '42%',
  balance: '33%',
  usd: '25%',
} as const;

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
    priceUnavailableLabel: _priceUnavailableLabel,
  }: IProtocolLendingPositionTableProps) => {
    const intl = useIntl();
    const labels = useMemo(
      () => ({
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
              <Stack width={COLUMN_WIDTHS.asset} minWidth={0}>
                <SizableText size="$headingXs" color="$textSubdued">
                  {section.title}
                </SizableText>
              </Stack>
              <Stack width={COLUMN_WIDTHS.balance} minWidth={0}>
                <SizableText size="$headingXs" color="$textSubdued">
                  {labels.balance}
                </SizableText>
              </Stack>
              <Stack
                width={COLUMN_WIDTHS.usd}
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
                  width={COLUMN_WIDTHS.asset}
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
                <Stack width={COLUMN_WIDTHS.balance} minWidth={0}>
                  <NumberSizeableTextWrapper
                    hideValue
                    size="$bodyMd"
                    formatter="balance"
                    formatterOptions={{ tokenSymbol: asset.symbol }}
                    numberOfLines={1}
                  >
                    {asset.amount}
                  </NumberSizeableTextWrapper>
                </Stack>
                <Stack
                  width={COLUMN_WIDTHS.usd}
                  minWidth={0}
                  alignItems="flex-end"
                >
                  <NumberSizeableTextWrapper
                    hideValue
                    size="$bodyMdMedium"
                    formatter="value"
                    formatterOptions={{ currency: currencySymbol }}
                    textAlign="right"
                    numberOfLines={1}
                    fontVariant={TABULAR_NUMS}
                  >
                    {asset.value}
                  </NumberSizeableTextWrapper>
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

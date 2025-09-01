import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { Layout } from './utils/Layout';

const NumberSizeableTextGallery = () => (
  <Layout
    filePath={__CURRENT_FILE_PATH__}
    componentName="NumberSizeableText"
    elements={[
      {
        title: 'balance',
        element: (
          <YStack gap="$3">
            <NumberSizeableText formatter="balance">1abcd1</NumberSizeableText>
            <SizableText>
              {numberFormat('1abcd1', { formatter: 'balance' })}
            </SizableText>
            <NumberSizeableText formatter="balance">
              564230002184512.1242
            </NumberSizeableText>
            <SizableText>
              {numberFormat('564230002184512.1242', {
                formatter: 'balance',
              })}
            </SizableText>
            <NumberSizeableText formatter="balance">
              39477128561230002184512.1242
            </NumberSizeableText>
            <SizableText>
              {numberFormat('39477128561230002184512.1242', {
                formatter: 'balance',
              })}
            </SizableText>
            <NumberSizeableText formatter="balance">0.0045</NumberSizeableText>
            <SizableText>
              {numberFormat('0.0045', {
                formatter: 'balance',
              })}
            </SizableText>
            <NumberSizeableText formatter="balance">
              0.00000002146
            </NumberSizeableText>
            <SizableText>
              {numberFormat('0.00000002146', {
                formatter: 'balance',
              })}
            </SizableText>
            <NumberSizeableText
              formatter="balance"
              formatterOptions={{
                tokenSymbol: 'ETC',
                showPlusMinusSigns: true,
              }}
            >
              0.0000000214562
            </NumberSizeableText>
            <SizableText>
              {numberFormat('0.0000000214562', {
                formatter: 'balance',
              })}
            </SizableText>
            <NumberSizeableText
              formatter="balance"
              formatterOptions={{
                tokenSymbol: 'USDT',
                showPlusMinusSigns: true,
              }}
            >
              -100.16798000000214562
            </NumberSizeableText>
            <SizableText>
              {numberFormat('-100.16798000000214562', {
                formatter: 'balance',
                formatterOptions: {
                  tokenSymbol: 'USDT',
                  showPlusMinusSigns: true,
                },
              })}
            </SizableText>
            <NumberSizeableText
              formatter="balance"
              formatterOptions={{
                tokenSymbol: 'USDC',
                showPlusMinusSigns: true,
              }}
            >
              202.16798000000214562
            </NumberSizeableText>
            <SizableText>
              {numberFormat('202.16798000000214562', {
                formatter: 'balance',
                formatterOptions: {
                  tokenSymbol: 'USDC',
                  showPlusMinusSigns: true,
                },
              })}
            </SizableText>
            <NumberSizeableText
              formatter="balance"
              subTextStyle={{ color: 'red' }}
            >
              0.00000002146
            </NumberSizeableText>
            <SizableText>
              {numberFormat('0.00000002146', {
                formatter: 'balance',
              })}
            </SizableText>
          </YStack>
        ),
      },
      {
        title: 'price',
        element: (
          <YStack gap="$3">
            <NumberSizeableText
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              1abcd1
            </NumberSizeableText>
            <SizableText>
              {numberFormat('1abcd1', {
                formatter: 'price',
                formatterOptions: { currency: '$' },
              })}
            </SizableText>
            <NumberSizeableText
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              0.0045
            </NumberSizeableText>
            <SizableText>
              {numberFormat('0.0045', {
                formatter: 'price',
                formatterOptions: { currency: '$' },
              })}
            </SizableText>
            <NumberSizeableText
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              0.00000000000000009
            </NumberSizeableText>
            <NumberSizeableText
              size="$bodySm"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              0.00000000000000009
            </NumberSizeableText>
            <NumberSizeableText
              size="$headingXl"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              0.00000000000000009
            </NumberSizeableText>
            <NumberSizeableText
              size="$heading3xl"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              0.00000000000000009
            </NumberSizeableText>
            <NumberSizeableText
              size="$heading5xl"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              0.00000000000000009
            </NumberSizeableText>
            <NumberSizeableText
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              0.00000002146
            </NumberSizeableText>
            <SizableText>
              {numberFormat('0.00000002146', {
                formatter: 'price',
                formatterOptions: { currency: '$' },
              })}
            </SizableText>
          </YStack>
        ),
      },
      {
        title: 'priceChange',
        element: (
          <YStack gap="$3">
            <NumberSizeableText formatter="priceChange">
              1abcd1
            </NumberSizeableText>
            <SizableText>
              {numberFormat('1abcd1', {
                formatter: 'priceChange',
              })}
            </SizableText>
            <NumberSizeableText formatter="priceChange">
              12312381912937323374.7
            </NumberSizeableText>
            <SizableText>
              {numberFormat('12312381912937323374.7', {
                formatter: 'priceChange',
              })}
            </SizableText>
            <NumberSizeableText formatter="priceChange">
              -0.02
            </NumberSizeableText>
            <SizableText>
              {numberFormat('-0.02', {
                formatter: 'priceChange',
              })}
            </SizableText>
            <NumberSizeableText formatter="priceChange">
              -6218129
            </NumberSizeableText>
            <SizableText>
              {numberFormat('-6218129', {
                formatter: 'priceChange',
              })}
            </SizableText>
          </YStack>
        ),
      },
      {
        title: 'value',
        element: (
          <YStack gap="$3">
            <NumberSizeableText
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              1abcd1
            </NumberSizeableText>
            <SizableText>
              {numberFormat('1abcd1', {
                formatter: 'value',
                formatterOptions: { currency: '$' },
              })}
            </SizableText>
            <NumberSizeableText
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              0
            </NumberSizeableText>
            <NumberSizeableText
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              0.009
            </NumberSizeableText>
            <SizableText>
              {numberFormat('0.009', {
                formatter: 'value',
                formatterOptions: { currency: '$' },
              })}
            </SizableText>
            <NumberSizeableText
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              912312381912937323375
            </NumberSizeableText>
            <SizableText>
              {numberFormat('912312381912937323375', {
                formatter: 'value',
                formatterOptions: { currency: '$' },
              })}
            </SizableText>
            <NumberSizeableText
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              12312381912937323374.7
            </NumberSizeableText>
            <SizableText>
              {numberFormat('12312381912937323374.7', {
                formatter: 'value',
                formatterOptions: { currency: '$' },
              })}
            </SizableText>
          </YStack>
        ),
      },
      {
        title: 'marketCap / MarketCap / Volume / Liquidty / TVL / TokenSupply',
        element: (
          <YStack gap="$3">
            <NumberSizeableText formatter="marketCap">
              1abcd1
            </NumberSizeableText>
            <SizableText>
              {numberFormat('1abcd1', {
                formatter: 'marketCap',
              })}
            </SizableText>
            <NumberSizeableText formatter="marketCap">
              0.125423
            </NumberSizeableText>
            <SizableText>
              {numberFormat('0.125423', {
                formatter: 'marketCap',
              })}
            </SizableText>
            <NumberSizeableText formatter="marketCap">
              22.125423
            </NumberSizeableText>
            <SizableText>
              {numberFormat('22.125423', {
                formatter: 'marketCap',
              })}
            </SizableText>
            <NumberSizeableText formatter="marketCap">
              882134512
            </NumberSizeableText>
            <SizableText>
              {numberFormat('882134512', {
                formatter: 'marketCap',
              })}
            </SizableText>
            <NumberSizeableText formatter="marketCap">
              235002184512.1242
            </NumberSizeableText>
            <SizableText>
              {numberFormat('235002184512.1242', {
                formatter: 'marketCap',
              })}
            </SizableText>
            <NumberSizeableText formatter="marketCap">
              564200002184512.1242
            </NumberSizeableText>
            <SizableText>
              {numberFormat('564200002184512.1242', {
                formatter: 'marketCap',
              })}
            </SizableText>
            <SizableText>
              {numberFormat(
                '32551169648428747600528316797038958441150665382888568684348849999999999999999999999999999999999999999999999123123038958441150665382888568684303895844115066538288856868430389584411506653828885686843038958441150665382888568684303895844115066538288856868430389584411506653828885686843038',
                {
                  formatter: 'marketCap',
                },
              )}
            </SizableText>
          </YStack>
        ),
      },
      {
        title: 'marketCap with capAtMaxT',
        element: (
          <YStack gap="$6">
            <SizableText size="$bodyMd">
              The capAtMaxT option caps very large numbers at 999T maximum for
              better UI consistency.
            </SizableText>

            <XStack gap="$2">
              <YStack gap="$2">
                <SizableText size="$bodyMd">Without capAtMaxT:</SizableText>
                <NumberSizeableText
                  formatter="marketCap"
                  formatterOptions={{ currency: '$' }}
                >
                  1200000000000000
                </NumberSizeableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  Shows actual value: $1,200T
                </SizableText>
              </YStack>
              <YStack gap="$2">
                <SizableText size="$bodyMd">With capAtMaxT:</SizableText>
                <NumberSizeableText
                  formatter="marketCap"
                  formatterOptions={{ currency: '$', capAtMaxT: true }}
                >
                  1200000000000000
                </NumberSizeableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  Capped at maximum: $999T
                </SizableText>
              </YStack>
            </XStack>
            <YStack gap="$2">
              <SizableText size="$bodyMd">
                More examples with capAtMaxT:
              </SizableText>
              <XStack gap="$4">
                <YStack gap="$1">
                  <SizableText size="$bodySm">500T (not capped):</SizableText>
                  <NumberSizeableText
                    formatter="marketCap"
                    formatterOptions={{ currency: '$', capAtMaxT: true }}
                  >
                    500000000000000
                  </NumberSizeableText>
                </YStack>
                <YStack gap="$1">
                  <SizableText size="$bodySm">999T (not capped):</SizableText>
                  <NumberSizeableText
                    formatter="marketCap"
                    formatterOptions={{ currency: '$', capAtMaxT: true }}
                  >
                    999000000000000
                  </NumberSizeableText>
                </YStack>
                <YStack gap="$1">
                  <SizableText size="$bodySm">1000T (capped):</SizableText>
                  <NumberSizeableText
                    formatter="marketCap"
                    formatterOptions={{ currency: '$', capAtMaxT: true }}
                  >
                    1000000000000000
                  </NumberSizeableText>
                </YStack>
              </XStack>
            </YStack>
          </YStack>
        ),
      },
      {
        title: 'autoFormatter',
        element: (
          <YStack gap="$3">
            <YStack gap="$1">
              <SizableText size="$bodySm">
                Small value (uses price formatter):
              </SizableText>
              <NumberSizeableText
                autoFormatter="price-marketCap"
                formatterOptions={{ currency: '$', capAtMaxT: true }}
              >
                123.45
              </NumberSizeableText>
            </YStack>
            <YStack gap="$1">
              <SizableText size="$bodySm">
                Large value (uses marketCap formatter):
              </SizableText>
              <NumberSizeableText
                autoFormatter="price-marketCap"
                formatterOptions={{ currency: '$', capAtMaxT: true }}
              >
                2500000
              </NumberSizeableText>
            </YStack>
            <YStack gap="$1">
              <SizableText size="$bodySm">
                Balance autoFormatter (small):
              </SizableText>
              <NumberSizeableText
                autoFormatter="balance-marketCap"
                formatterOptions={{ tokenSymbol: 'ETH' }}
              >
                0.0045
              </NumberSizeableText>
            </YStack>
            <YStack gap="$1">
              <SizableText size="$bodySm">
                Balance autoFormatter (large):
              </SizableText>
              <NumberSizeableText
                autoFormatter="balance-marketCap"
                formatterOptions={{ tokenSymbol: 'ETH' }}
              >
                5000000
              </NumberSizeableText>
            </YStack>
            <YStack gap="$1">
              <SizableText size="$bodySm">Custom threshold (500K):</SizableText>
              <NumberSizeableText
                autoFormatter="price-marketCap"
                autoFormatterThreshold={500_000}
                formatterOptions={{ currency: '$', capAtMaxT: true }}
              >
                750000
              </NumberSizeableText>
            </YStack>
          </YStack>
        ),
      },
    ]}
  />
);

export default NumberSizeableTextGallery;

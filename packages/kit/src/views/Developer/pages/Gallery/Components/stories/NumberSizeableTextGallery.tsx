import { NumberSizeableText, SizableText, YStack } from '@onekeyhq/components';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { Layout } from './utils/Layout';

const NumberSizeableTextGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'balance',
        element: (
          <YStack space="$3">
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
          <YStack space="$3">
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
          <YStack space="$3">
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
          <YStack space="$3">
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
          <YStack space="$3">
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
    ]}
  />
);

export default NumberSizeableTextGallery;

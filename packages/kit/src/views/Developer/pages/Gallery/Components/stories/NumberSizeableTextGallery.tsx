import { NumberSizeableText, YStack } from '@onekeyhq/components';
import { formatBalance } from '@onekeyhq/shared/src/utils/numberUtils';

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
            <NumberSizeableText formatter="balance">
              564230002184512.1242
            </NumberSizeableText>
            <NumberSizeableText formatter="balance">
              39477128561230002184512.1242
            </NumberSizeableText>
            <NumberSizeableText formatter="balance">0.0045</NumberSizeableText>
            <NumberSizeableText formatter="balance">
              0.00000002146
            </NumberSizeableText>
            <NumberSizeableText
              formatter="balance"
              formatterOptions={{
                tokenSymbol: 'ETC',
                showPlusMinusSigns: true,
              }}
            >
              0.0000000214562
            </NumberSizeableText>
            <NumberSizeableText
              formatter="balance"
              formatterOptions={{
                tokenSymbol: 'USDT',
                showPlusMinusSigns: true,
              }}
            >
              -100.16798000000214562
            </NumberSizeableText>
            <NumberSizeableText
              formatter="balance"
              formatterOptions={{
                tokenSymbol: 'USDC',
                showPlusMinusSigns: true,
              }}
            >
              202.16798000000214562
            </NumberSizeableText>
            <NumberSizeableText
              formatter="balance"
              subTextStyle={{ color: 'red' }}
            >
              0.00000002146
            </NumberSizeableText>
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
            <NumberSizeableText
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              13557362245700035555161495398047413998367933131241010410691763880119784559016062844916472252762015173133555676356423519969743085158179152633859513576266605508375167501289296167138332859964556394542868213514778276007018586151530368896935403362153851120149886761999054463554127943866078939583808923520112330553910779375966862567701643361707370405490856611696753232661556874041759.1242
            </NumberSizeableText>
            <NumberSizeableText
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              0.0045
            </NumberSizeableText>
            <NumberSizeableText
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              0.00000002146
            </NumberSizeableText>
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
            <NumberSizeableText formatter="priceChange">
              12312381912937323374.7
            </NumberSizeableText>
            <NumberSizeableText formatter="priceChange">
              -0.02
            </NumberSizeableText>
            <NumberSizeableText formatter="priceChange">
              -6218129
            </NumberSizeableText>
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
            <NumberSizeableText
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              0.009
            </NumberSizeableText>
            <NumberSizeableText
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              912312381912937323375
            </NumberSizeableText>
            <NumberSizeableText
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              12312381912937323374.7
            </NumberSizeableText>
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
            <NumberSizeableText formatter="marketCap">
              0.125423
            </NumberSizeableText>
            <NumberSizeableText formatter="marketCap">
              22.125423
            </NumberSizeableText>
            <NumberSizeableText formatter="marketCap">
              882134512
            </NumberSizeableText>
            <NumberSizeableText formatter="marketCap">
              235002184512.1242
            </NumberSizeableText>
            <NumberSizeableText formatter="marketCap">
              564200002184512.1242
            </NumberSizeableText>
          </YStack>
        ),
      },
    ]}
  />
);

export default NumberSizeableTextGallery;

import { Stack } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';

import { Layout } from './utils/Layout';

const CurrencyGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Currency',
        element: (
          <Stack space="$4">
            <Currency sourceCurrency="btc" targetCurrency="btc">
              1
            </Currency>
            <Currency sourceCurrency="btc" targetCurrency="usd">
              1
            </Currency>
            <Currency sourceCurrency="usd" targetCurrency="btc">
              1
            </Currency>
            <Currency sourceCurrency="btc" targetCurrency="eur">
              1
            </Currency>
            <Currency sourceCurrency="btc" targetCurrency="gbp">
              1
            </Currency>
            <Currency sourceCurrency="btc" targetCurrency="cny">
              1
            </Currency>
            <Currency sourceCurrency="btc" targetCurrency="hkd">
              1
            </Currency>
            <Currency sourceCurrency="btc" targetCurrency="jpy">
              1
            </Currency>
            <Currency sourceCurrency="jpy" targetCurrency="btc">
              1
            </Currency>
            <Currency sourceCurrency="btc" targetCurrency="eth">
              1
            </Currency>
            <Currency sourceCurrency="btc" targetCurrency="aud">
              1
            </Currency>
          </Stack>
        ),
      },
    ]}
  />
);

export default CurrencyGallery;

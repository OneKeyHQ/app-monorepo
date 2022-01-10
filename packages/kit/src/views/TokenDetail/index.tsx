import React from 'react';

import { Box, ScrollView, VStack } from '@onekeyhq/components';

import { StackBasicRoutes } from '../../routes';
import HistoricalRecords from '../Wallet/HistoricalRecords';

import { TokenDetailRoutesParams } from './routes';
import TokenInfo from './TokenInfo';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TokenDetailViewProps = NativeStackScreenProps<
  TokenDetailRoutesParams,
  StackBasicRoutes.ScreenTokenDetail
>;

const TOKEN = {
  'chainId': 1,
  'address': '0xfF20817765cB7f73d4bde2e66e067E58D11095C2',
  'name': 'Amp',
  'symbol': 'AMP',
  'decimals': 18,
  'logoURI':
    'https://assets.coingecko.com/coins/images/12409/thumb/amp-200x200.png?1599625397',
  'amount': '9999999999.0000123',
  fiatAmount: '99.11 USD',
};

const TokenDetail: React.FC<TokenDetailViewProps> = ({ route }) => {
  //   const { defaultValues } = route.params;

  console.log(route);

  return (
    <ScrollView>
      <VStack>
        <Box maxW="1024px">
          <TokenInfo token={TOKEN} />
          <HistoricalRecords />
        </Box>
      </VStack>
    </ScrollView>
  );
};
export default TokenDetail;

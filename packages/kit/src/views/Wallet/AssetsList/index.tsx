import React from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Tabs } from 'react-native-collapsible-tab-view';

import {
  Box,
  Divider,
  Icon,
  Pressable,
  ScrollableFlatListProps,
  Text,
  Token,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import {
  ManageTokenModalRoutes,
  ManageTokenRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManageToken';

import { StackBasicRoutes } from '../../../routes';
import { TokenDetailNavigation } from '../../TokenDetail/routes';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenModalRoutes.ListTokensModal
> &
  TokenDetailNavigation;

export type AssetToken = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  amount: string;
  fiatAmount: string;
};

const TOKEN_DATA: AssetToken[] = [
  {
    'chainId': 1,
    'address': '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    'name': 'Aave',
    'symbol': 'AAVE',
    'decimals': 18,
    'logoURI':
      'https://assets.coingecko.com/coins/images/12645/thumb/AAVE.png?1601374110',
    'amount': '123 ETH',
    fiatAmount: '999999.11 USD',
  },
  {
    'chainId': 1,
    'address': '0xfF20817765cB7f73d4bde2e66e067E58D11095C2',
    'name': 'Amp',
    'symbol': 'AMP',
    'decimals': 18,
    'logoURI':
      'https://assets.coingecko.com/coins/images/12409/thumb/amp-200x200.png?1599625397',
    'amount': '9999999.0000000123 ETH',
    fiatAmount: '99.11 USD',
  },
  {
    'name': 'Aragon Network Token',
    'address': '0x960b236A07cf122663c4303350609A66A7B288C0',
    'symbol': 'ANT',
    'decimals': 18,
    'chainId': 1,
    'logoURI':
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x960b236A07cf122663c4303350609A66A7B288C0/logo.png',
    'amount': '0.0000000123 ETH',
    fiatAmount: '999.11 USD',
  },
  {
    'name': 'Balancer',
    'address': '0xba100000625a3754423978a60c9317c58a424e3D',
    'symbol': 'BAL',
    'decimals': 18,
    'chainId': 1,
    'logoURI':
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xba100000625a3754423978a60c9317c58a424e3D/logo.png',
    'amount': '0.0000000123 ETH',
    fiatAmount: '9999.11 USD',
  },
  {
    'chainId': 1,
    'address': '0xBA11D00c5f74255f56a5E366F4F77f5A186d7f55',
    'name': 'Band Protocol',
    'symbol': 'BAND',
    'decimals': 18,
    'logoURI':
      'https://assets.coingecko.com/coins/images/9545/thumb/band-protocol.png?1568730326',
    'amount': '0.0000000123 ETH',
    fiatAmount: '99999.11 USD',
  },
  {
    'name': 'Bancor Network Token',
    'address': '0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C',
    'symbol': 'BNT',
    'decimals': 18,
    'chainId': 1,
    'logoURI':
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C/logo.png',
    'amount': '0.0000000123 ETH',
    fiatAmount: '9999999.11 USD',
  },
  {
    'name': 'Compound',
    'address': '0xc00e94Cb662C3520282E6f5717214004A7f26888',
    'symbol': 'COMP',
    'decimals': 18,
    'chainId': 1,
    'logoURI':
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xc00e94Cb662C3520282E6f5717214004A7f26888/logo.png',
    'amount': '0.0000000123 ETH',
    fiatAmount: '999999999.11 USD',
  },
  {
    'name': 'Curve DAO Token',
    'address': '0xD533a949740bb3306d119CC777fa900bA034cd52',
    'symbol': 'CRV',
    'decimals': 18,
    'chainId': 1,
    'logoURI':
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xD533a949740bb3306d119CC777fa900bA034cd52/logo.png',
    'amount': '0.0000000123 ETH',
    fiatAmount: '999999999999.11 USD',
  },
  {
    'chainId': 1,
    'address': '0x41e5560054824eA6B0732E656E3Ad64E20e94E45',
    'name': 'Civic',
    'symbol': 'CVC',
    'decimals': 8,
    'logoURI':
      'https://assets.coingecko.com/coins/images/788/thumb/civic.png?1547034556',

    'amount': '0.0000000123 ETH',
    fiatAmount: '999999999999.11 USD',
  },
  {
    'name': 'Dai Stablecoin',
    'address': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    'symbol': 'DAI',
    'decimals': 18,
    'chainId': 1,
    'logoURI':
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    'amount': '0.0000000123 ETH',
    fiatAmount: '999999999999.11 USD',
  },
  {
    'chainId': 1,
    'address': '0x0AbdAce70D3790235af448C88547603b945604ea',
    'name': 'district0x',
    'symbol': 'DNT',
    'decimals': 18,
    'logoURI':
      'https://assets.coingecko.com/coins/images/849/thumb/district0x.png?1547223762',
    'amount': '0.0000000123 ETH',
    fiatAmount: '99999999.11 USD',
  },
  {
    'chainId': 1,
    'address': '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72',
    'name': 'Ethereum Name Service',
    'symbol': 'ENS',
    'decimals': 18,
    'logoURI':
      'https://assets.coingecko.com/coins/images/19785/thumb/acatxTm8_400x400.jpg?1635850140',
    'amount': '0.0000000123 ETH',
    fiatAmount: '999999.11 USD',
  },
  {
    'name': 'Gnosis Token',
    'address': '0x6810e776880C02933D47DB1b9fc05908e5386b96',
    'symbol': 'GNO',
    'decimals': 18,
    'chainId': 1,
    'logoURI':
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6810e776880C02933D47DB1b9fc05908e5386b96/logo.png',
    'amount': '0.0000000123 ETH',
    fiatAmount: '99999.11 USD',
  },
  {
    'chainId': 1,
    'address': '0xc944E90C64B2c07662A292be6244BDf05Cda44a7',
    'name': 'The Graph',
    'symbol': 'GRT',
    'decimals': 18,
    'logoURI':
      'https://assets.coingecko.com/coins/images/13397/thumb/Graph_Token.png?1608145566',
    'amount': '0.0000000123 ETH',
    fiatAmount: '9999.11 USD',
  },
  {
    'chainId': 1,
    'address': '0x85Eee30c52B0b379b046Fb0F85F4f3Dc3009aFEC',
    'name': 'Keep Network',
    'symbol': 'KEEP',
    'decimals': 18,
    'logoURI':
      'https://assets.coingecko.com/coins/images/3373/thumb/IuNzUb5b_400x400.jpg?1589526336',
    'amount': '0.0000000123 ETH',
    fiatAmount: '999.11 USD',
  },
  {
    'name': 'Kyber Network Crystal',
    'address': '0xdd974D5C2e2928deA5F71b9825b8b646686BD200',
    'symbol': 'KNC',
    'decimals': 18,
    'chainId': 1,
    'logoURI':
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdd974D5C2e2928deA5F71b9825b8b646686BD200/logo.png',
    'amount': '0.0000000123 ETH',
    fiatAmount: '99.11 USD',
  },
];

const AssetsList = () => {
  const navigation = useNavigation<NavigationProps>();
  const { size } = useUserDevice();
  const intl = useIntl();

  const renderItem: ScrollableFlatListProps<AssetToken>['renderItem'] = ({
    item,
    index,
  }) => (
    <Pressable.Item
      p={4}
      borderTopRadius={index === 0 ? '12px' : '0px'}
      borderRadius={index === TOKEN_DATA.length - 1 ? '12px' : '0px'}
      onPress={() => {
        navigation.navigate(StackBasicRoutes.ScreenTokenDetail, {
          defaultValues: {
            accountId: '',
            networkId: '',
            tokenId: '',
          },
        });
        console.log('Click Token : ', item.address);
      }}
    >
      <Box w="100%" flexDirection="row" alignItems="center">
        <Token
          size={8}
          address={item.address}
          chain={item.chainId.toString()}
          src={item.logoURI}
        />
        <Box ml={3} mr={3} flexDirection="column" flex={1}>
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {item.amount}
          </Text>
          <Typography.Body2 color="text-subdued">
            {item.fiatAmount}
          </Typography.Body2>
        </Box>
        {['LARGE', 'XLARGE'].includes(size) && (
          <Box ml={3} mr={20} flexDirection="row" flex={1}>
            <Icon size={20} name="ActivityOutline" />
            <Typography.Body2Strong ml={3}>
              {item.fiatAmount}
            </Typography.Body2Strong>
          </Box>
        )}
        <Icon size={20} name="ChevronRightSolid" />
      </Box>
    </Pressable.Item>
  );

  return (
    <Tabs.FlatList
      contentContainerStyle={{ paddingHorizontal: 16, marginTop: 16 }}
      data={TOKEN_DATA}
      renderItem={renderItem}
      ListHeaderComponent={() => (
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          pb={4}
        >
          <Typography.Heading>
            {intl.formatMessage({ id: 'asset__tokens' })}
          </Typography.Heading>
          <Pressable
            p={1.5}
            onPress={() =>
              navigation.navigate(ManageTokenModalRoutes.ListTokensModal)
            }
          >
            <Icon size={20} name="AdjustmentsSolid" />
          </Pressable>
        </Box>
      )}
      ItemSeparatorComponent={Divider}
      ListFooterComponent={() => <Box h="20px" />}
      keyExtractor={(_item: AssetToken, index: number) => index.toString()}
      extraData={size}
      showsVerticalScrollIndicator={false}
    />
  );
};

export default AssetsList;

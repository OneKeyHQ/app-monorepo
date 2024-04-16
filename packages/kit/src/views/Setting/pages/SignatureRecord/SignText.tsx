import { StyleSheet } from 'react-native';

import {
  IconButton,
  Image,
  SectionList,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

const message = {
  'types': {
    'EIP712Domain': [
      {
        'name': 'name',
        'type': 'string',
      },
      {
        'name': 'version',
        'type': 'string',
      },
      {
        'name': 'chainId',
        'type': 'uint256',
      },
      {
        'name': 'verifyingContract',
        'type': 'address',
      },
    ],
    'LimitOrder': [
      {
        'type': 'address',
        'name': 'makerToken',
      },
      {
        'type': 'address',
        'name': 'takerToken',
      },
      {
        'type': 'uint128',
        'name': 'makerAmount',
      },
      {
        'type': 'uint128',
        'name': 'takerAmount',
      },
      {
        'type': 'uint128',
        'name': 'takerTokenFeeAmount',
      },
      {
        'type': 'address',
        'name': 'maker',
      },
      {
        'type': 'address',
        'name': 'taker',
      },
      {
        'type': 'address',
        'name': 'sender',
      },
      {
        'type': 'address',
        'name': 'feeRecipient',
      },
      {
        'type': 'bytes32',
        'name': 'pool',
      },
      {
        'type': 'uint64',
        'name': 'expiry',
      },
      {
        'type': 'uint256',
        'name': 'salt',
      },
    ],
  },
  'domain': {
    'chainId': 137,
    'verifyingContract': '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
    'name': 'ZeroEx',
    'version': '1.0.0',
  },
  'primaryType': 'LimitOrder',
  'message': {
    'makerToken': '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    'takerToken': '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    'makerAmount': '100000000000000000',
    'takerAmount': '70170',
    'takerTokenFeeAmount': '211',
    'maker': '0xec766119a2021956773f16cf77a3b248ff79b1c7',
    'taker': '0x0000000000000000000000000000000000000000',
    'sender': '0x0000000000000000000000000000000000000000',
    'feeRecipient': '0xaD09FCe8d34fc38241909FA803EA68E27E85c6e0',
    'pool':
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    'expiry': '1713272499',
    'salt': '1713271899401',
  },
};

const SignTextItem = () => (
  <YStack
    borderWidth={StyleSheet.hairlineWidth}
    mx="$5"
    borderRadius="$3"
    borderColor="$borderSubdued"
    overflow="hidden"
    mb="$3"
  >
    <XStack justifyContent="space-between" pt="$3" px="$3" pb="$1">
      <SizableText size="$bodyMd">11:40 • OneKey Wallet</SizableText>
      <IconButton variant="tertiary" icon="OpenOutline" size="small" />
    </XStack>
    <XStack justifyContent="space-between" p="$3">
      <SizableText maxHeight="$24" size="$bodyLgMedium">
        {JSON.stringify(message, null, 2)}
      </SizableText>
    </XStack>
    <XStack p="$3" backgroundColor="$bgSubdued" alignItems="center">
      <Image
        pl="$1"
        width={16}
        height={16}
        src="https://onekey-asset.com/assets/eth/eth.png"
        mr="$2"
      />
      <SizableText color="$textSubdued">
        Polygon • 0x123456...1234567
      </SizableText>
    </XStack>
  </YStack>
);

type ISectionListData = {
  title: string;
  data: { key: number }[];
};

export const SignText = () => (
  <SectionList
    sections={
      [
        { title: '', data: [{ key: 1 }, { key: 2 }] },
        { title: '', data: [{ key: 3 }, { key: 4 }] },
      ] as ISectionListData[]
    }
    estimatedItemSize="$36"
    ItemSeparatorComponent={null}
    SectionSeparatorComponent={null}
    renderSectionHeader={() => (
      <SectionList.SectionHeader title="JAN 30 2024" />
    )}
    renderItem={() => <SignTextItem />}
  />
);

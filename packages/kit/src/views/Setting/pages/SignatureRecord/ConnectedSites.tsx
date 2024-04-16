import { StyleSheet } from 'react-native';

import {
  IconButton,
  Image,
  SectionList,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

const TransactionItem = () => (
  <YStack
    borderWidth={StyleSheet.hairlineWidth}
    mx="$5"
    mb="$3"
    borderRadius="$3"
    borderColor="$borderSubdued"
    overflow="hidden"
  >
    <XStack justifyContent="space-between" pt="$3" px="$3" pb="$1">
      <SizableText size="$bodyMd">11:40 • OneKey Wallet</SizableText>
      <IconButton variant="tertiary" icon="OpenOutline" size="small" />
    </XStack>
    <XStack p="$3" alignItems="center">
      <Image
        width={40}
        height={40}
        src="https://onekey-asset.com/assets/eth/eth.png"
        mr="$3"
      />
      <SizableText size="$bodyLgMedium">https://app.unisap.org</SizableText>
    </XStack>
    <YStack p="$3" backgroundColor="$bgSubdued">
      <XStack alignItems="center">
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
      <XStack alignItems="center">
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
  </YStack>
);

type ISectionListData = {
  title: string;
  data: { key: number }[];
};

export const ConnectedSites = () => (
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
    renderItem={() => <TransactionItem />}
  />
);

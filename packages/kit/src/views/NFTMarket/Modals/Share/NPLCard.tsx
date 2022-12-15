import { ComponentProps, FC, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { BlurView } from 'expo-blur';
import { Column } from 'native-base';
import { View } from 'react-native';

import {
  Box,
  Center,
  HStack,
  Text,
  ZStack,
  useTheme,
} from '@onekeyhq/components';
import { NFTNPL } from '@onekeyhq/engine/src/types/nft';

import useFormatDate from '../../../../hooks/useFormatDate';
import NFTListImage from '../../../Wallet/NFT/NFTList/NFTListImage';
import { PriceString } from '../../PriceText';

type Props = {
  data: NFTNPL;
  scale: number;
  opacity: number;
};
export const NPLCard: FC<Props> = ({ data, scale, opacity }) => {
  const { entry, exit } = data;
  const profit = (exit?.tradePrice ?? 0) - (entry?.tradePrice ?? 0);
  const { formatDistanceStrict } = useFormatDate();
  const { themeVariant } = useTheme();

  return (
    <View
      style={{
        borderRadius: 12,
        opacity: opacity || 1,
        width: 358,
        transform: [{ scale }],
        overflow: 'hidden',
      }}
    >
      {data?.asset && (
        <Center position="absolute" top={0} right={0} bottom={0} left={0}>
          <NFTListImage asset={data?.asset} size={358} />
        </Center>
      )}
      <BlurView
        tint={themeVariant === 'light' ? 'light' : 'dark'}
        intensity={100}
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <HStack alignItems="center" space={3} flex={1}>
          {data?.asset && (
            <NFTListImage asset={data?.asset} size={40} borderRadius="12px" />
          )}
          <Column flex={1} space={1}>
            <Text isTruncated typography="Body1Strong">
              {data.contractName}
            </Text>
            <Text isTruncated typography="Body2" color="text-subdued">
              {data.tokenId ? `#${data.tokenId}` : '–'}
            </Text>
          </Column>
        </HStack>
        <Column>
          <Text
            typography="Body1Strong"
            textAlign="right"
            color={profit > 0 ? 'text-success' : 'text-critical'}
          >
            {PriceString({
              price: new BigNumber(profit).decimalPlaces(3).toString(),
              symbol: data.exit.tradeSymbol,
            })}
          </Text>
          <Text typography="Body2" textAlign="right" color="text-subdued">
            {formatDistanceStrict(exit.timestamp, entry.timestamp)}
          </Text>
        </Column>
      </BlurView>
    </View>
  );
};

type GroupProps = {
  datas: NFTNPL[];
} & ComponentProps<typeof ZStack>;

export const NPLCardGroup: FC<GroupProps> = ({ datas, ...props }) => {
  const [pageWidth, setPageWidth] = useState<number>(0);

  const ml = -(pageWidth - (pageWidth * pageWidth) / 358) / 2;
  return (
    <ZStack
      onLayout={(e) => {
        if (pageWidth !== e.nativeEvent.layout.width) {
          setPageWidth(e.nativeEvent.layout.width);
        }
      }}
      {...props}
    >
      {datas[0] && pageWidth > 0 && (
        <Box zIndex={1} ml={ml} mt="-10px">
          <NPLCard data={datas[0]} scale={(pageWidth / 358) * 0.81} />
        </Box>
      )}
      {datas[1] && pageWidth > 0 && (
        <Box ml={ml} mt="9px" zIndex={2}>
          <NPLCard data={datas[1]} scale={(pageWidth / 358) * 0.9} />
        </Box>
      )}
      {datas[2] && pageWidth > 0 && (
        <Box ml={ml} mt="34px" zIndex={3}>
          <NPLCard data={datas[2]} scale={pageWidth / 358} />
        </Box>
      )}
    </ZStack>
  );
};

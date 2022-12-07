import { ComponentProps, FC, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { BlurView } from 'expo-blur';
import { Column } from 'native-base';
import { View } from 'react-native';

import { Box, Text, ZStack } from '@onekeyhq/components';
import { NFTNPL } from '@onekeyhq/engine/src/types/nft';

import useFormatDate from '../../../../hooks/useFormatDate';
import NFTListImage from '../../../Wallet/NFT/NFTList/NFTListImage';
import { PriceString } from '../../PriceText';

type Props = {
  data: NFTNPL;
  scale: number;
};
export const NPLCard: FC<Props> = ({ data, scale }) => {
  const { entry, exit } = data;
  const profit = (exit?.tradePrice ?? 0) - (entry?.tradePrice ?? 0);
  const { formatDistanceStrict } = useFormatDate();

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        opacity: 0.9,
        width: 358,
        height: 72,
        transform: [{ scale }],
        overflow: 'hidden',
      }}
    >
      {data?.asset && (
        <NFTListImage
          opacity={0.9}
          asset={data?.asset}
          size={358}
          borderRadius="10px"
        />
      )}
      <BlurView
        style={{
          width: 358,
          height: 72,
          position: 'absolute',
          paddingHorizontal: 16,
          paddingVertical: 12,
          opacity: 0.9,
        }}
      >
        <Box flexDirection="row">
          <Box flexDirection="row" flex={1} alignItems="center">
            {data?.asset && (
              <NFTListImage asset={data?.asset} size={40} borderRadius="10px" />
            )}
            <Column ml="12px" flex={1}>
              <Text numberOfLines={1} typography="Body1Strong">
                {data.contractName}
              </Text>
              <Text numberOfLines={1} typography="Body2" color="text-subdued">
                {data.tokenId ? `#${data.tokenId}` : '–'}
              </Text>
            </Column>
          </Box>
          <Column flex={1}>
            <Text
              numberOfLines={1}
              typography="Body1Strong"
              textAlign="right"
              color={profit > 0 ? 'text-success' : 'text-critical'}
            >
              {PriceString({
                price: new BigNumber(profit).decimalPlaces(3).toString(),
                symbol: data.exit.tradeSymbol,
              })}
            </Text>
            <Text
              numberOfLines={1}
              typography="Body2"
              textAlign="right"
              color="text-subdued"
            >
              {formatDistanceStrict(exit.timestamp, entry.timestamp)}
            </Text>
          </Column>
        </Box>
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

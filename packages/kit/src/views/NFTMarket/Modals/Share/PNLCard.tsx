import type { ComponentProps, FC } from 'react';
import { useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

import {
  Box,
  Center,
  HStack,
  Image,
  Text,
  VStack,
  ZStack,
  useTheme,
} from '@onekeyhq/components';
import type { NFTPNL } from '@onekeyhq/engine/src/types/nft';
import BlurBackground from '@onekeyhq/kit/assets/pnl_share_blur_bg.png';

import useFormatDate from '../../../../hooks/useFormatDate';
import NFTListImage from '../../../Wallet/NFT/NFTList/NFTListImage';
import { PriceString } from '../../PriceText';

type Props = {
  data?: NFTPNL;
  scale: number;
  opacity?: number;
};

export const PNLCard: FC<Props> = ({ data, scale, opacity }) => {
  const { formatDistanceStrict } = useFormatDate();
  const { themeVariant } = useTheme();

  let description = '';
  if (data) {
    description = data.tokenId ? `#${data.tokenId}` : '–';
    if (
      data.contractAddress?.toLowerCase() ===
      '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85'
    ) {
      description = data.asset?.name as string;
    }
  }

  return (
    <Box
      width="358px"
      shadow="depth.1"
      opacity={opacity || 1}
      style={{
        transform: [{ scale }],
      }}
    >
      {data ? (
        <Box
          borderRadius="12px"
          overflow="hidden"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="border-default"
        >
          {data?.asset && (
            <Center
              position="absolute"
              top={0}
              right={0}
              bottom={0}
              left={0}
              bgColor="background-default"
            >
              <NFTListImage asset={data?.asset} size={378} opacity={50} />
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
                <NFTListImage
                  asset={data?.asset}
                  size={40}
                  borderRadius="12px"
                />
              )}
              <VStack flex={1} space={1}>
                <Text isTruncated typography="Body1Strong">
                  {data.contractName}
                </Text>
                <Text isTruncated typography="Body2" color="text-subdued">
                  {description}
                </Text>
              </VStack>
            </HStack>
            <VStack space={1}>
              <Text
                typography="Body1Strong"
                textAlign="right"
                color={data.profit > 0 ? 'text-success' : 'text-critical'}
              >
                {PriceString({
                  price: new BigNumber(data.profit).decimalPlaces(3).toString(),
                  symbol: data.exit.tradeSymbol,
                })}
              </Text>
              <Text typography="Body2" textAlign="right" color="text-subdued">
                {formatDistanceStrict(
                  data.exit.timestamp,
                  data.entry.timestamp,
                )}
              </Text>
            </VStack>
          </BlurView>
        </Box>
      ) : (
        <Box
          borderRadius="12px"
          overflow="hidden"
          height="72px"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="border-default"
          bgColor="surface-neutral-subdued"
        />
      )}
    </Box>
  );
};

type GroupProps = {
  datas: NFTPNL[];
} & ComponentProps<typeof ZStack>;

export const PNLCardGroup: FC<GroupProps> = ({ datas, ...props }) => {
  const [pageWidth, setPageWidth] = useState<number>(0);

  return (
    <ZStack
      justifyContent="center"
      alignItems="center"
      onLayout={(e) => {
        if (pageWidth !== e.nativeEvent.layout.width) {
          setPageWidth(e.nativeEvent.layout.width);
        }
      }}
      {...props}
    >
      <Image zIndex={0} source={BlurBackground} width={300} height={300} />
      {pageWidth > 0 && (
        <Box zIndex={1} mt="-40px" style={{ transform: [{ translateY: -21 }] }}>
          <PNLCard
            data={datas[2]}
            scale={(pageWidth / 358) * 0.81}
            opacity={70}
          />
        </Box>
      )}
      {pageWidth > 0 && (
        <Box zIndex={2}>
          <PNLCard
            data={datas[1]}
            scale={(pageWidth / 358) * 0.9}
            opacity={80}
          />
        </Box>
      )}
      {pageWidth > 0 && (
        <Box zIndex={3} mt="48px" style={{ transform: [{ translateY: 26 }] }}>
          <PNLCard data={datas[0]} scale={pageWidth / 358} opacity={90} />
        </Box>
      )}
    </ZStack>
  );
};

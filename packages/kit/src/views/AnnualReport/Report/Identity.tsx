import type { ComponentProps, FC } from 'react';

import { random } from 'lodash';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';
import Carousel from 'react-native-snap-carousel';

import { Box, HStack, Image, Text, VStack } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import c1 from '@onekeyhq/kit/assets/annual/card-1.png';
import c2 from '@onekeyhq/kit/assets/annual/card-2.png';
import c3 from '@onekeyhq/kit/assets/annual/card-3.png';
import c4 from '@onekeyhq/kit/assets/annual/card-4.png';
import c5 from '@onekeyhq/kit/assets/annual/card-5.png';
import qrcode from '@onekeyhq/kit/assets/annual/qrcode.png';
import logo from '@onekeyhq/kit/assets/qrcode_logo.png';

import { WText } from '../components';

import type { PageProps } from '../types';
import type { ImageSourcePropType } from 'react-native';

export const tags = [
  {
    tag: 'HODLER',
    image: c1,
    desc: 'content__hodler_desc',
  },
  {
    tag: 'NFT Collector',
    image: c2,
    desc: 'content__nft_collector_desc',
  },
  {
    tag: 'Web3 Trader',
    image: c3,
    desc: 'content__web3_trader_desc',
  },
  {
    tag: 'DeFi Master',
    image: c4,
    desc: 'content__defi_master_desc',
  },
  {
    tag: 'Web3 Master',
    image: c5,
    desc: 'content__web3_master_desc',
  },
] as const;

export const Card: FC<
  {
    name: string;
    tag: string;
    image: ImageSourcePropType;
    desc: LocaleIds;
  } & ComponentProps<typeof Box>
> = ({ name, tag, image, desc, w, ...props }) => {
  const intl = useIntl();
  const { height } = useWindowDimensions();
  return (
    <Box
      borderRadius="16px"
      bg="#1E252F"
      overflow="hidden"
      {...props}
      w="307px"
    >
      <Image
        source={image}
        w={`${307}px`}
        h={`${height < 800 ? 200 : 289}px`}
      />
      <VStack px="4" pt="4" pb="3">
        <WText
          fontSize="14px"
          fontFamily="mono"
          lineHeight="17px"
          fontWeight="900"
        >
          {name}
        </WText>
        <WText color="#34C759" fontSize="32px" fontWeight="900">
          {tag}
        </WText>
        <WText
          fontSize="14px"
          fontFamily="mono"
          lineHeight="17px"
          fontWeight="900"
        >
          of 2022
        </WText>
        <WText
          mt="2"
          fontSize="16px"
          fontWeight="400"
          color="#fff"
          numberOfLines={3}
          minHeight="57px"
        >
          {intl.formatMessage({ id: desc })}
        </WText>
        <HStack justifyContent="space-between" mt="5">
          <HStack alignItems="center">
            <Image borderRadius="14px" source={logo} w={8} h={8} />
            <Text fontSize="18px" color="#44D62C" ml="1" fontWeight="800">
              OneKey
            </Text>
          </HStack>
          <Image borderRadius="6px" source={qrcode} size={10} />
        </HStack>
      </VStack>
    </Box>
  );
};

const Identity: FC<PageProps> = ({
  params: { name },
  selectedCardIndex,
  onSelectedCardIndexChange,
}) => {
  const intl = useIntl();
  const { width } = useWindowDimensions();

  return (
    <VStack flex="1" justifyContent="center" pb="90px">
      <Box>
        <WText
          textAlign="center"
          fontWeight="600"
          fontSize="20px"
          color="#E2E2E8"
          px="6"
          mb="6"
        >
          {intl.formatMessage({
            id: 'content__looking_back_at_your_on_chain_story_you_are_the',
          })}
        </WText>
        <Carousel
          loop
          data={tags}
          firstItem={selectedCardIndex ?? random(0, 5)}
          sliderWidth={width}
          itemWidth={307}
          renderItem={({ item }) => <Card {...item} name={name} />}
          onSnapToItem={(index) => onSelectedCardIndexChange?.(index)}
        />
      </Box>
    </VStack>
  );
};

export default Identity;

import type { ComponentProps, FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Center,
  HStack,
  Image,
  ScrollView,
  Text,
  VStack,
} from '@onekeyhq/components';
import bg from '@onekeyhq/kit/assets/annual/3.png';
import bgStart from '@onekeyhq/kit/assets/annual/bg_start.png';
import c1 from '@onekeyhq/kit/assets/annual/card-1.png';
import c2 from '@onekeyhq/kit/assets/annual/card-2.png';
import c3 from '@onekeyhq/kit/assets/annual/card-3.png';
import c4 from '@onekeyhq/kit/assets/annual/card-4.png';
import c5 from '@onekeyhq/kit/assets/annual/card-5.png';
import qrcode from '@onekeyhq/kit/assets/annual/qrcode.png';
import logo from '@onekeyhq/kit/assets/qrcode_logo.png';

import { BgButton, Container, WText } from '../components';

import type { HomeRoutesParams } from '../../../routes/types';
import type { ImageSourcePropType } from 'react-native';

const tags = [
  {
    tag: 'HODLER',
    image: c1,
    desc: `您是守正不移的持有者，\b时光向前流淌，依然坚守本心。`,
  },
  {
    tag: 'NFT Collector',
    image: c2,
    desc: `您是守正不移的持有者，\n时光向前流淌，依然坚守本心。`,
  },
  {
    tag: 'Web3 Trader',
    image: c3,
    desc: `您是守正不移的持有者，\n时光向前流淌，依然坚守本心。`,
  },
  {
    tag: 'DeFi Master',
    image: c4,
    desc: `您是守正不移的持有者，\n时光向前流淌，依然坚守本心。`,
  },
  {
    tag: 'Web3 Master',
    image: c5,
    desc: `您是守正不移的持有者，\n时光向前流淌，依然坚守本心。`,
  },
];

const Card: FC<
  {
    name: string;
    tag: string;
    image: ImageSourcePropType;
    desc: string;
    w: number;
  } & ComponentProps<typeof Box>
> = ({ name, tag, image, desc, w, ...props }) => (
  <Box
    borderRadius="16px"
    bg="#1E252F"
    overflow="hidden"
    {...props}
    w={`${w}px`}
  >
    <Image source={image} w={`${w}px`} h={`${289 * (w / 307)}px`} />
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
      <WText mt="2" fontSize="16px" fontWeight="400" color="#fff">
        {desc}
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

const CardContainer: FC<{
  index: number;
  name: string;
  scrolling: boolean;
}> = ({ index, name, scrolling }) => {
  const prev = scrolling ? undefined : tags[index - 1];
  const current = tags[index];
  const next = scrolling ? undefined : tags[index + 1];
  const { width } = useWindowDimensions();
  const w = useMemo(() => width - 42 * 2, [width]);
  return (
    <HStack width={`${width}px`}>
      <HStack
        alignItems="center"
        justifyContent="flex-end"
        w="42px"
        pr="10px"
        overflow="hidden"
        opacity="0.3"
      >
        {prev ? <Card name={name} {...prev} w={w} /> : null}
      </HStack>
      <HStack alignItems="center" justifyContent="flex-end" flex="1">
        <Card name={name} {...current} w={w} />
      </HStack>
      <HStack
        alignItems="center"
        w="42px"
        overflow="hidden"
        pl="10px"
        opacity="0.3"
      >
        {next ? <Card name={name} {...next} w={w} /> : null}
      </HStack>
    </HStack>
  );
};

const AnnualPage7: FC<{
  height: number;
  params: HomeRoutesParams['AnnualReport'];
}> = ({ height, params: { name } }) => {
  const intl = useIntl();
  const [scrolling, setScrolling] = useState(false);

  const handleScrollBegin = useCallback(() => {
    setScrolling(true);
  }, []);

  const handleScrollEnd = useCallback(() => {
    setScrolling(false);
  }, []);

  return (
    <Container
      bg={bg}
      height={height}
      showLogo={false}
      containerProps={{ px: '0' }}
    >
      <WText
        textAlign="center"
        fontWeight="600"
        fontSize="20px"
        color="#E2E2E8"
        mb="6"
      >
        {intl.formatMessage({
          id: 'content__looking_back_at_your_on_chain_story_you_are_the',
        })}
      </WText>
      <ScrollView
        horizontal
        pagingEnabled
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={handleScrollEnd}
      >
        {tags.map((t, i) => (
          <CardContainer
            scrolling={scrolling}
            name={name}
            index={i}
            key={t.tag}
          />
        ))}
      </ScrollView>
      <Center mt="6">
        <BgButton w={196} h={50} bg={bgStart} onPress={console.log}>
          <WText fontSize="16" fontWeight="600">
            {intl.formatMessage({ id: 'action__save_image' })}
          </WText>
        </BgButton>
      </Center>
    </Container>
  );
};

export default AnnualPage7;

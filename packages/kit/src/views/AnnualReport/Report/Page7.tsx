import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { random } from 'lodash';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  HStack,
  Image,
  ScrollView,
  Text,
  VStack,
} from '@onekeyhq/components';
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
import type {
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView as ScrollViewType,
} from 'react-native';

const tags = [
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

const Card: FC<
  {
    name: string;
    tag: string;
    image: ImageSourcePropType;
    desc: LocaleIds;
    w: number;
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
      w={`${w}px`}
    >
      <Image source={image} w={`${w}px`} h={`${height < 800 ? 200 : 289}px`} />
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
    <HStack
      width={`${width}px`}
      alignItems="flex-start"
      justifyContent="flex-start"
    >
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

const AnnualPage7: FC<PageProps> = ({
  params: { name },
  selectedCardIndex,
  onSelectedCardIndexChange,
}) => {
  const ref = useRef<ScrollViewType>();
  const intl = useIntl();
  const [scrolling, setScrolling] = useState(false);
  const { width } = useWindowDimensions();

  const handleScrollBegin = useCallback(() => {
    setScrolling(true);
  }, []);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setScrolling(false);
      const { contentOffset } = e.nativeEvent;
      const viewSize = e.nativeEvent.layoutMeasurement;
      const pageNum = Math.floor(contentOffset.x / viewSize.width);
      onSelectedCardIndexChange?.(pageNum);
    },
    [onSelectedCardIndexChange],
  );

  useEffect(() => {
    const x = (selectedCardIndex ?? random(0, 5)) * width;
    const timeout = setTimeout(() => {
      ref.current?.scrollTo({
        animated: true,
        x,
      });
    }, 600);
    return () => clearTimeout(timeout);
  }, [width, selectedCardIndex]);

  return (
    <>
      <WText
        textAlign="center"
        fontWeight="600"
        fontSize="20px"
        color="#E2E2E8"
        px="6"
      >
        {intl.formatMessage({
          id: 'content__looking_back_at_your_on_chain_story_you_are_the',
        })}
      </WText>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={{ paddingTop: 24 }}
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
    </>
  );
};

export default AnnualPage7;

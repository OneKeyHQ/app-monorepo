import type { ComponentProps, FC } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { useFonts } from 'expo-font';
import { useIntl } from 'react-intl';
import { Animated, ImageBackground, StatusBar } from 'react-native';

import {
  Center,
  HStack,
  Icon,
  Image,
  Pressable,
  Text,
  VStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import bg1 from '@onekeyhq/kit/assets/annual/2.jpg';
import bg2 from '@onekeyhq/kit/assets/annual/3.jpg';
import bg3 from '@onekeyhq/kit/assets/annual/4.jpg';
import bg4 from '@onekeyhq/kit/assets/annual/5.jpg';
import bg5 from '@onekeyhq/kit/assets/annual/6.jpg';
import bg6 from '@onekeyhq/kit/assets/annual/7.jpg';
import bg7 from '@onekeyhq/kit/assets/annual/8.jpg';
import qrcode from '@onekeyhq/kit/assets/annual/qrcode.png';
import down from '@onekeyhq/kit/assets/annual/scrolldown.png';
import logo from '@onekeyhq/kit/assets/qrcode_logo.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigation } from '../../hooks';

import type { ImageSourcePropType } from 'react-native';

export const bgs = {
  bg1,
  bg2,
  bg3,
  bg4,
  bg5,
  bg6,
  bg7,
};

export const useHeaderHide = () => {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
};

export const Header: FC<{ showHeaderLogo?: boolean }> = ({
  showHeaderLogo,
}) => {
  const navigation = useNavigation();
  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <HStack justifyContent="space-between" px="6">
        {showHeaderLogo ? (
          <HStack alignItems="center">
            <Image borderRadius="14px" source={logo} w={8} h={8} />
            <Text fontSize="24px" color="#fff" ml="1" fontWeight="800">
              OneKey
            </Text>
          </HStack>
        ) : (
          <HStack flex="1" />
        )}
        <Pressable onPress={handleClose}>
          <Center size="30px" borderRadius="full" bg="rgba(255, 255, 255, 0.1)">
            <Icon name="XMarkMini" size={20} color="text-on-primary" />
          </Center>
        </Pressable>
      </HStack>
    </>
  );
};

export const Footer: FC<{
  onShare?: () => void;
  showIndicator?: boolean;
}> = ({ onShare, showIndicator }) => {
  const intl = useIntl();

  const offset = useRef(new Animated.Value(0)).current;

  const startAnimation = useCallback(() => {
    const slide = Animated.sequence([
      Animated.timing(offset, {
        toValue: 10,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(offset, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]);
    Animated.loop(slide).start();
  }, [offset]);

  useEffect(() => {
    if (showIndicator) {
      startAnimation();
    }
  }, [startAnimation, showIndicator]);

  return (
    <HStack
      position="absolute"
      alignItems="center"
      bg="rgba(19, 19, 27, 0.8)"
      left="0"
      bottom="0"
      py="4"
      px="6"
      w="full"
      zIndex="99"
    >
      {showIndicator ? (
        <Center w="full" px="6" position="absolute" bottom="82px" left="24px">
          <Animated.Image
            borderRadius={14}
            source={down}
            style={{
              transform: [{ translateY: offset }],
              width: 34.5,
              height: 18,
            }}
          />
        </Center>
      ) : null}
      <Image borderRadius="14px" source={logo} w={8} h={8} />
      <VStack ml="3" flex="1">
        <Text
          textTransform="uppercase"
          color="#fff"
          lineHeight="20px"
          fontSize="16"
          fontWeight="800"
        >
          {intl.formatMessage({
            id: 'content___2022_my_on_chain_journey_uppercase',
          })}
        </Text>
      </VStack>
      <Pressable onPress={onShare}>
        <Center size="34px" bg="rgba(255,255,255,.1)" borderRadius="full">
          <Icon name="ShareMini" color="icon-on-primary" size={20} />
        </Center>
      </Pressable>
    </HStack>
  );
};

export const ShareFooter: FC = () => {
  const intl = useIntl();
  return (
    <HStack
      bg="rgba(0, 6, 17, 0.8)"
      px="30px"
      py="4"
      justifyContent="space-between"
      alignItems="center"
      position="absolute"
      bottom="0"
      left="0"
      w="full"
      zIndex="99"
    >
      <VStack>
        <HStack alignItems="center">
          <Image borderRadius="14px" source={logo} w={8} h={8} />
          <Text fontSize="24px" color="#44D62C" ml="1" fontWeight="800">
            OneKey
          </Text>
        </HStack>
        <Text
          fontSize="14px"
          textTransform="uppercase"
          color="#fff"
          opacity=".5"
          fontWeight="500"
        >
          2022{' '}
          {intl.formatMessage({
            id: 'title__my_on_chain_journey',
          })}
        </Text>
      </VStack>
      <Image mt="10px" borderRadius="6px" source={qrcode} w="60px" h="60px" />
    </HStack>
  );
};

export const BgButton: FC<{
  bg: ImageSourcePropType;
  onPress?: () => void;
  w: number;
  h: number;
}> = ({ onPress, bg, w, h, children }) => {
  const content = useMemo(
    () => (
      <Center w="full" h="full">
        {children}
      </Center>
    ),
    [children],
  );
  return (
    <ImageBackground
      source={bg}
      resizeMode="stretch"
      style={{ width: w, height: h }}
    >
      {onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content}
    </ImageBackground>
  );
};

export const Container: FC<{
  bg: ImageSourcePropType;
  shareMode?: boolean;
  showHeaderLogo?: boolean;
  containerProps?: ComponentProps<typeof VStack>;
}> = ({
  bg,
  children,
  shareMode = false,
  containerProps = {},
  showHeaderLogo,
}) => {
  const { top, bottom } = useSafeAreaInsets();

  return (
    <ImageBackground
      source={bg}
      resizeMode="stretch"
      style={{
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <VStack
        pt={`${platformEnv.isNativeAndroid ? 24 : top}px`}
        pb={`${bottom}px`}
        flex="1"
        position="relative"
        w="full"
      >
        {shareMode ? null : <Header showHeaderLogo={showHeaderLogo} />}
        <VStack flex="1" px="6" overflowY="scroll" {...containerProps}>
          {children}
        </VStack>
        {shareMode ? <ShareFooter /> : null}
      </VStack>
    </ImageBackground>
  );
};

export const WText: FC<
  ComponentProps<typeof Text> & {
    useCustomFont?: boolean;
  }
> = ({ children, useCustomFont = false, ...props }) => {
  const [loaded] = useFonts({
    Montserrat: require('../../../../components/src/Provider/fonts/HKGroteskWide-Black.otf'),
  });
  return (
    <Text
      fontFamily={loaded && useCustomFont ? 'Montserrat' : undefined}
      color="#fff"
      fontSize="16"
      fontWeight="800"
      {...props}
    >
      {children}
    </Text>
  );
};

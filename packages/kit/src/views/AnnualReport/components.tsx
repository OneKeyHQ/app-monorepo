import type { ComponentProps, FC } from 'react';
import { useCallback, useLayoutEffect, useMemo } from 'react';

import { ImageBackground, useWindowDimensions } from 'react-native';

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
import logo from '@onekeyhq/kit/assets/qrcode_logo.png';

import { useNavigation } from '../../hooks';

import type { ImageSourcePropType } from 'react-native';

export const useHeaderHide = () => {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
};

export const Logo: FC<{
  showLogo?: boolean;
}> = ({ showLogo = true }) => {
  const navigation = useNavigation();

  const onPress = useCallback(() => {
    if (navigation) {
      navigation.goBack();
    }
  }, [navigation]);

  return (
    <HStack justifyContent="space-between" px="6">
      {showLogo ? (
        <HStack alignItems="center">
          <Image borderRadius="14px" source={logo} w={8} h={8} />
          <Text fontSize="24px" color="text-on-primary" ml="1" fontWeight="800">
            OneKey
          </Text>
        </HStack>
      ) : (
        <HStack flex="1" />
      )}
      <Pressable onPress={onPress}>
        <Center size="30px" borderRadius="full" bg="rgba(255, 255, 255, 0.1)">
          <Icon name="XMarkMini" size={20} color="text-on-primary" />
        </Center>
      </Pressable>
    </HStack>
  );
};

export const Footer: FC<{
  onShare?: () => void;
}> = ({ onShare }) => (
  <HStack
    alignItems="center"
    bg="rgba(19, 19, 27, 0.8)"
    left="0"
    bottom="0"
    pt="4"
    px="6"
    pb="10"
  >
    <Image borderRadius="14px" source={logo} w={8} h={8} />
    <VStack ml="3" flex="1">
      <Text
        color="text-on-primary"
        lineHeight="20px"
        fontSize="16"
        fontWeight="800"
      >
        2022
      </Text>
      <Text
        textTransform="uppercase"
        color="text-on-primary"
        lineHeight="20px"
        fontSize="16"
        fontWeight="800"
      >
        My on-chain Journey.
      </Text>
    </VStack>
    <Pressable onPress={onShare}>
      <Center size="34px" bg="rgba(255,255,255,.1)" borderRadius="full">
        <Icon name="ShareMini" color="icon-on-primary" size={20} />
      </Center>
    </Pressable>
  </HStack>
);

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
  showLogo?: boolean;
  showFooter?: boolean;
  onShare?: () => void;
  height?: number;
  containerProps?: ComponentProps<typeof VStack>;
}> = ({
  bg,
  children,
  showLogo = true,
  height,
  showFooter = true,
  onShare,
  containerProps = {},
}) => {
  const { top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <ImageBackground
      source={bg}
      resizeMode="stretch"
      style={{ height: height ?? '100%', width }}
    >
      <VStack style={{ width, height: height ?? '100%' }} pt={`${top}px`}>
        <Logo showLogo={showLogo} />
        <VStack flex="1" px="6" {...containerProps}>
          {children}
        </VStack>
        {showFooter ? <Footer onShare={onShare} /> : null}
      </VStack>
    </ImageBackground>
  );
};

export const WText: FC<ComponentProps<typeof Text>> = ({
  children,
  ...props
}) => (
  <Text color="text-on-primary" fontSize="16" fontWeight="800" {...props}>
    {children}
  </Text>
);

import type { ComponentProps, FC } from 'react';
import { useCallback, useLayoutEffect, useMemo } from 'react';

import { ImageBackground } from 'react-native';

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
import qrcode from '@onekeyhq/kit/assets/annual/qrcode.png';
import down from '@onekeyhq/kit/assets/annual/scrolldown.png';
import logo from '@onekeyhq/kit/assets/qrcode_logo.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigation } from '../../hooks';

import type { ImageSourcePropType } from 'react-native';

export const useHeaderHide = () => {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
};

export const Footer: FC<{
  onShare?: () => void;
  showIndicator?: boolean;
}> = ({ onShare, showIndicator }) => (
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
        <Image borderRadius="14px" source={down} w={34.5} h={18} />
      </Center>
    ) : null}
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

export const ShareFooter: FC = () => (
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
        2022 My on-chain Journey.
      </Text>
    </VStack>
    <Image mt="10px" borderRadius="6px" source={qrcode} w="60px" h="60px" />
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
  showHeader?: boolean;
  showHeaderLogo?: boolean;
  renderShareFooter?: boolean;
  showIndicator?: boolean;
  onShare?: () => void;
  containerProps?: ComponentProps<typeof VStack>;
}> = ({
  bg,
  children,
  showHeaderLogo = true,
  showHeader = true,
  showIndicator = true,
  onShare,
  renderShareFooter = false,
  containerProps = {},
}) => {
  const { top, bottom } = useSafeAreaInsets();

  const navigation = useNavigation();

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

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
        {showHeader ? (
          <HStack justifyContent="space-between" px="6">
            {showHeaderLogo ? (
              <HStack alignItems="center">
                <Image borderRadius="14px" source={logo} w={8} h={8} />
                <Text
                  fontSize="24px"
                  color="text-on-primary"
                  ml="1"
                  fontWeight="800"
                >
                  OneKey
                </Text>
              </HStack>
            ) : (
              <HStack flex="1" />
            )}
            <Pressable onPress={handleClose}>
              <Center
                size="30px"
                borderRadius="full"
                bg="rgba(255, 255, 255, 0.1)"
              >
                <Icon name="XMarkMini" size={20} color="text-on-primary" />
              </Center>
            </Pressable>
          </HStack>
        ) : null}
        <VStack flex="1" px="6" overflowY="scroll" {...containerProps}>
          {children}
        </VStack>
        {renderShareFooter ? <ShareFooter /> : null}
        {onShare ? (
          <Footer onShare={onShare} showIndicator={showIndicator} />
        ) : null}
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

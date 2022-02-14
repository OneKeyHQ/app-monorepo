/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { ComponentProps, FC } from 'react';

import {
  Box,
  HStack,
  Icon,
  IconButton,
  Image,
  Pressable,
  ScrollView,
  Typography,
  VStack,
} from '@onekeyhq/components';

import type { AccountType } from './index';

type WalletItemProps = {
  isSelected?: boolean;
  decorationColor?: string;
  walletType?: AccountType;
  emoji?: string;
  deviceIconUrl?: string;
} & ComponentProps<typeof Pressable>;

const WalletItem: FC<WalletItemProps> = ({
  isSelected,
  decorationColor,
  walletType,
  emoji,
  deviceIconUrl,
  ...rest
}) => (
  <Pressable {...rest}>
    {({ isHovered }) => (
      <HStack pr={2} space="5px">
        <Box
          w="3px"
          borderTopRightRadius="full"
          borderBottomRightRadius="full"
          bg={
            // eslint-disable-next-line no-nested-ternary
            isSelected
              ? 'interactive-default'
              : isHovered
              ? 'icon-subdued'
              : 'transparent'
          }
        />
        <Box
          w={12}
          h={12}
          bg={decorationColor}
          borderRadius={isSelected ? 'xl' : 'full'}
          alignItems="center"
          justifyContent="center"
        >
          {walletType === 'hd' && (
            <Typography.DisplayLarge>{emoji && emoji}</Typography.DisplayLarge>
          )}
          {walletType === 'hw' && (
            <Image width="22px" height="32px" source={{ uri: deviceIconUrl }} />
          )}
          {walletType === 'imported' && <Icon name="SaveOutline" />}
          {walletType === 'watching' && <Icon name="EyeOutline" />}
        </Box>
      </HStack>
    )}
  </Pressable>
);

const WalletItemDefaultProps = {
  isSelected: false,
  decorationColor: 'surface-neutral-default',
} as const;

WalletItem.defaultProps = WalletItemDefaultProps;

type LeftSideProps = {
  activeAccountType: AccountType;
  setActiveAccountType: (v: AccountType) => void;
};

const LeftSide: FC<LeftSideProps> = ({
  activeAccountType,
  setActiveAccountType,
}) => (
  <VStack borderRightWidth={1} borderRightColor="border-subdued">
    <ScrollView>
      <VStack space={6} py={2}>
        {/* APP Wallet */}
        {/* <VStack space={2}>
          <WalletItem
            onPress={() => setActiveAccountType('normal')}
            isSelected={activeAccountType === 'normal'}
            decorationColor="#FFF7D7"
            walletType="normal"
            emoji="👽"
          />
        </VStack> */}
        {/* Hardware Wallet */}
        {/* <VStack space={2}>
          <WalletItem
            onPress={() => setActiveAccountType('hd')}
            isSelected={activeAccountType === 'hd'}
            decorationColor="#FFE0DF"
            walletType="hd"
            deviceIconUrl={MiniDeviceIcon}
          />
        </VStack> */}
        {/* Imported or watched wallet */}
        <VStack space={2}>
          {/* <WalletItem
            onPress={() => setActiveAccountType('imported')}
            isSelected={activeAccountType === 'imported'}
            walletType="imported"
          /> */}
          <WalletItem
            onPress={() => setActiveAccountType('watching')}
            isSelected={activeAccountType === 'watching'}
            walletType="watching"
          />
        </VStack>
      </VStack>
    </ScrollView>
    {/* <Box p={2}>
      <IconButton type="plain" name="PlusOutline" size="xl" />
    </Box> */}
  </VStack>
);

export default LeftSide;

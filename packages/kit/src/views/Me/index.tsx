import React from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  HStack,
  Icon,
  Pressable,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { StackBasicRoutes, StackRoutesParams } from '@onekeyhq/kit/src/routes';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  StackRoutesParams,
  StackBasicRoutes.Developer
>;

const Me = () => {
  const navigation = useNavigation<NavigationProps>();

  return (
    <Box flex="1" p="4" maxW="1024px" w="100%" marginX="auto">
      <VStack space="3">
        <Pressable
          p="4"
          bg="surface-default"
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <HStack space="4">
            <Icon name="BookOpenOutline" />
            <Typography.Body1>Address Book</Typography.Body1>
          </HStack>
          <Icon name="ChevronRightOutline" />
        </Pressable>
        <Pressable
          p="4"
          bg="surface-default"
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <HStack space="4">
            <Icon name="CreditCardOutline" />
            <Typography.Body1>OneKey Lite</Typography.Body1>
          </HStack>
          <Icon name="ChevronRightOutline" />
        </Pressable>
        <Pressable
          p="4"
          bg="surface-default"
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          onPress={() => navigation.navigate(StackBasicRoutes.SettingsScreen)}
        >
          <HStack space="4">
            <Icon name="CogOutline" />
            <Typography.Body1>Settings</Typography.Body1>
          </HStack>
          <Icon name="ChevronRightOutline" />
        </Pressable>
        <Pressable
          p="4"
          bg="surface-default"
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          onPress={() => navigation.navigate(StackBasicRoutes.Developer)}
        >
          <HStack space="4">
            <Icon name="DesktopComputerSolid" />
            <Typography.Body1>Developer</Typography.Body1>
          </HStack>
          <Icon name="ChevronRightOutline" />
        </Pressable>
      </VStack>
    </Box>
  );
};

export default Me;

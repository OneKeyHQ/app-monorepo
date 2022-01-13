import React from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  HStack,
  Icon,
  Pressable,
  SegmentedControl,
  Typography,
  VStack,
  useLocale,
  useTheme,
} from '@onekeyhq/components';
import { StackBasicRoutes, StackRoutesParams } from '@onekeyhq/kit/src/routes';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  StackRoutesParams,
  StackBasicRoutes.Developer
>;

const Me = () => {
  const { setThemeVariant, themeVariant } = useTheme();
  const { locale, setLocale } = useLocale();
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
        <Box
          p="4"
          bg="surface-default"
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography.Body1>主题</Typography.Body1>
          <SegmentedControl
            containerProps={{
              width: '148px',
            }}
            options={[
              { label: '浅色', value: 'light' },
              { label: '深色', value: 'dark' },
            ]}
            defaultValue={themeVariant}
            onChange={(theme) => setThemeVariant(theme as 'dark')}
          />
        </Box>
        <Box
          p="4"
          bg="surface-default"
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography.Body1>语言</Typography.Body1>
          <SegmentedControl
            containerProps={{
              width: '148px',
            }}
            options={[
              { label: '简体中文', value: 'zh-CN' },
              { label: 'English', value: 'en-US' },
            ]}
            defaultValue={locale}
            onChange={(l) => setLocale(l as 'zh-CN')}
          />
        </Box>
        <Box
          p="4"
          bg="surface-default"
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography.Body1>法币</Typography.Body1>
          <SegmentedControl
            containerProps={{
              width: '148px',
            }}
            options={[
              { label: '美元', value: 'USD' },
              { label: '人民币', value: 'yuan' },
            ]}
            defaultValue="USD"
          />
        </Box>
        <Pressable
          p="4"
          bg="surface-default"
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          onPress={() => navigation.navigate(StackBasicRoutes.Developer)}
        >
          <Typography.Body1>development</Typography.Body1>
          <Icon name="ChevronRightOutline" size={12} />
        </Pressable>
      </VStack>
    </Box>
  );
};

export default Me;

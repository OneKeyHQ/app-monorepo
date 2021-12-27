import React from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  Icon,
  Pressable,
  SegmentedControl,
  Typography,
  VStack,
  useLocale,
  useTheme,
} from '@onekeyhq/components';

const Me = () => {
  const { setThemeVariant, themeVariant } = useTheme();
  const { locale, setLocale } = useLocale();
  const navigation = useNavigation();
  return (
    <Box flex="1" p="4">
      <VStack space="3">
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
        <Pressable
          p="4"
          bg="surface-default"
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          onPress={() => navigation.navigate('Dev' as any)}
        >
          <Typography.Body1>development</Typography.Body1>
          <Icon name="ChevronRightOutline" size={12} />
        </Pressable>
      </VStack>
    </Box>
  );
};

export default Me;

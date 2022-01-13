import React from 'react';

import {
  Box,
  Button,
  HStack,
  Icon,
  Pressable,
  ScrollView,
  Select,
  Switch,
  Typography,
} from '@onekeyhq/components';
import { ThemeVariant } from '@onekeyhq/components/src/Provider/theme';
import { useAppDispatch, useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { setTheme } from '@onekeyhq/kit/src/store/reducers/settings';

export const Settings = () => {
  const dispatch = useAppDispatch();
  const { theme } = useSettings();

  return (
    <ScrollView
      _contentContainerStyle={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 4,
      }}
    >
      <Box
        display="flex"
        w="full"
        flexDirection="column"
        alignItems="center"
        maxW={768}
      >
        <Box w="full" mb="4">
          <Box p="2">
            <Typography.Subheading>GENERAL</Typography.Subheading>
          </Box>
          <Box borderRadius="12" bg="surface-default" shadow="depth.2">
            <Box>
              <Box
                display="flex"
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                px="4"
                py="2.5"
                borderBottomWidth="1"
                borderBottomColor="divider"
                zIndex={99}
              >
                <Typography.Body1>Theme</Typography.Body1>
                <Box>
                  <Select<ThemeVariant>
                    title="Theme"
                    isTriggerPlain
                    footer={null}
                    value={theme}
                    headerShown={false}
                    onChange={(value) => {
                      dispatch(setTheme(value));
                    }}
                    options={[
                      // {
                      //   label: 'System',
                      //   value: 'System',
                      // },
                      {
                        label: 'Light',
                        value: 'light',
                      },
                      {
                        label: 'Dark',
                        value: 'dark',
                      },
                    ]}
                  />
                </Box>
              </Box>
              <Box
                display="flex"
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                px="4"
                py="2.5"
                borderBottomWidth="1"
                borderBottomColor="divider"
                zIndex={98}
              >
                <Typography.Body1>Language</Typography.Body1>
                <Box>
                  <Select
                    isTriggerPlain
                    footer={null}
                    defaultValue="en"
                    headerShown={false}
                    options={[
                      {
                        label: 'English',
                        value: 'en',
                      },
                      {
                        label: '简体中文',
                        value: 'cn',
                      },
                    ]}
                  />
                </Box>
              </Box>
              <Box
                display="flex"
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
                px="4"
                py="2.5"
                zIndex={97}
              >
                <Typography.Body1>Fiat currency</Typography.Body1>
                <Box>
                  <Select
                    isTriggerPlain
                    footer={null}
                    headerShown={false}
                    defaultValue="USD"
                    options={[
                      {
                        label: 'CNY',
                        value: 'CNY',
                      },
                      {
                        label: 'USD',
                        value: 'USD',
                      },
                      {
                        label: 'KRW',
                        value: 'KRW',
                      },
                      {
                        label: 'GBP',
                        value: 'GBP',
                      },
                      {
                        label: 'EUR',
                        value: 'EUR',
                      },
                    ]}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
        <Box w="full" mb="4">
          <Box p="2">
            <Typography.Subheading>SECURITY</Typography.Subheading>
          </Box>
          <Box borderRadius="12" bg="surface-default" shadow="depth.2">
            <Box
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              p="4"
              borderBottomWidth="1"
              borderBottomColor="divider"
            >
              <Typography.Body1>Change Master Password</Typography.Body1>
              <Box>
                <Icon name="ChevronRightOutline" size={14} />
              </Box>
            </Box>
            <Box
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              p="4"
              borderBottomWidth="1"
              borderBottomColor="divider"
            >
              <Typography.Body1>App Lock</Typography.Body1>
              <Box>
                <Switch labelType="false" />
              </Box>
            </Box>
            <Box
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              px="4"
              py="2.5"
              borderBottomWidth="1"
              borderBottomColor="divider"
              zIndex={10}
            >
              <Typography.Body1>App Lock Timer</Typography.Body1>
              <Box>
                <Select
                  title="Theme"
                  isTriggerPlain
                  footer={null}
                  defaultValue="5 mintus"
                  headerShown={false}
                  options={[
                    {
                      label: '5 mintus',
                      value: '5 mintus',
                    },
                    {
                      label: '30 mintus',
                      value: '30 mintus',
                    },
                    {
                      label: '60 mintus',
                      value: '60 mintus',
                    },
                  ]}
                />
              </Box>
            </Box>
            <Box
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              p="4"
            >
              <Typography.Body2 color="text-critical">
                Reset App
              </Typography.Body2>
              <Box>
                <Icon name="ChevronRightOutline" size={14} />
              </Box>
            </Box>
          </Box>
        </Box>
        <Box w="full" mb="4">
          <Box p="2">
            <Typography.Subheading>ABOUT</Typography.Subheading>
          </Box>
          <Box borderRadius="12" bg="surface-default" shadow="depth.2">
            <Box
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              p="4"
              borderBottomWidth="1"
              borderBottomColor="divider"
            >
              <Box display="flex">
                <Typography.Body2>Version</Typography.Body2>
                <Typography.Body2>1.0.0</Typography.Body2>
              </Box>
              <Box>
                <Button>Check for Updates</Button>
              </Box>
            </Box>
            <Pressable
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              p="4"
              borderBottomWidth="1"
              borderBottomColor="divider"
            >
              <Typography.Body1>User Agreement</Typography.Body1>
              <Box>
                <Icon name="ChevronRightOutline" size={14} />
              </Box>
            </Pressable>
            <Pressable
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              p="4"
              borderBottomWidth="1"
              borderBottomColor="divider"
            >
              <Typography.Body1>Privacy Policy</Typography.Body1>
              <Box>
                <Icon name="ChevronRightOutline" size={14} />
              </Box>
            </Pressable>
            <Box
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              p="4"
              borderBottomWidth="1"
              borderBottomColor="divider"
            >
              <Typography.Body1>Office Website</Typography.Body1>
              <HStack space="2" alignItems="center">
                <Typography.Body2 color="text-success">
                  www.onekey.so
                </Typography.Body2>
                <Icon
                  name="ExternalLinkOutline"
                  color="text-success"
                  size={14}
                />
              </HStack>
            </Box>
            <Pressable
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              p="4"
              borderBottomWidth="1"
              borderBottomColor="divider"
            >
              <Typography.Body1>Discord</Typography.Body1>
              <HStack space="2" alignItems="center">
                <Typography.Body2 color="text-success">
                  discord.gg/nwUJaTzjzv
                </Typography.Body2>
                <Icon
                  name="ExternalLinkOutline"
                  color="text-success"
                  size={14}
                />
              </HStack>
            </Pressable>
            <Pressable
              display="flex"
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              p="4"
            >
              <Typography.Body1>Twitter</Typography.Body1>
              <HStack space="2" alignItems="center">
                <Typography.Body2 color="text-success">
                  twitter.com/onekeyhq
                </Typography.Body2>
                <Icon
                  name="ExternalLinkOutline"
                  color="text-success"
                  size={14}
                />
              </HStack>
            </Pressable>
          </Box>
        </Box>
      </Box>
    </ScrollView>
  );
};

export default Settings;

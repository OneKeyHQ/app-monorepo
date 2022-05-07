/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';

import { Box, ScrollView, useSafeAreaInsets } from '@onekeyhq/components';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  StackBasicRoutesParams,
  StackRoutes,
} from '@onekeyhq/kit/src/routes/Dev';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';

import { DebugSection } from '../Debug';
import HelpSelector from '../Help/HelpSelector';

import { AboutSection } from './AboutSection';
import { DefaultSection } from './DefaultSection';
import { DevSettingSection } from './DevSetting';
import { GenaralSection } from './GenaralSection';
import { SecuritySection } from './SecuritySection';

import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.Dev>,
  NativeStackNavigationProp<StackBasicRoutesParams, StackRoutes.Developer>
>;

export const Me = () => {
  const { enable: devModeEnable } = useSettings().devMode || {};

  const inset = useSafeAreaInsets();
  return (
    <Box bg="background-default" flex="1">
      <ScrollView px={4} py={{ base: 6, md: 8 }} bg="background-default">
        <Box w="full" maxW={576} mx="auto" pb={inset.bottom}>
          <DebugSection />
          <DefaultSection />
          <GenaralSection />
          <SecuritySection />
          {devModeEnable ? <DevSettingSection /> : null}
          <AboutSection />
        </Box>
      </ScrollView>
      <Box
        position="absolute"
        bottom={{ base: 4, md: 8 }}
        right={{ base: 4, md: 8 }}
      >
        <HelpSelector />
      </Box>
    </Box>
  );
};

export default Me;

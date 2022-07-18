import React from 'react';

import { Box, ScrollView, useSafeAreaInsets } from '@onekeyhq/components';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';

import HelpSelector from '../Help/HelpSelector';

import { AboutSection } from './AboutSection';
import { DefaultSection } from './DefaultSection';
import { DevSettingSection } from './DevSetting';
import { GenaralSection } from './GenaralSection';
import { SecuritySection } from './SecuritySection';
import { UtilSection } from './UtilSection';

export const Me = () => {
  const { enable: devModeEnable } = useSettings().devMode || {};

  const inset = useSafeAreaInsets();
  return (
    <Box bg="background-default" flex="1">
      <ScrollView px={4} py={{ base: 6, md: 8 }} bg="background-default">
        <Box w="full" maxW={768} mx="auto" pb={inset.bottom}>
          <UtilSection />
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

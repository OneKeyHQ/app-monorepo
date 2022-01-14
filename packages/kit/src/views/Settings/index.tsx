import React from 'react';

import { Box, ScrollView } from '@onekeyhq/components';

import { AboutSection } from './AboutSection';
import { GenaralSection } from './GenaralSection';
import { SecuritySection } from './SecuritySection';

export const Settings = () => (
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
      <GenaralSection />
      <SecuritySection />
      <AboutSection />
    </Box>
  </ScrollView>
);

export default Settings;

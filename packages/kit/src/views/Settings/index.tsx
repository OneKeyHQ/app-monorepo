import React, { useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, ScrollView } from '@onekeyhq/components';

import { AboutSection } from './AboutSection';
import { GenaralSection } from './GenaralSection';
import { SecuritySection } from './SecuritySection';

export const Settings = () => {
  const navigation = useNavigation();
  const intl = useIntl();
  useLayoutEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({
        id: 'title__settings',
      }),
    });
  }, [navigation, intl]);

  return (
    <ScrollView
      px={4}
      py={{ base: 6, md: 8 }}
      bg="background-default"
      _contentContainerStyle={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
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
};

export default Settings;

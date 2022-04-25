import React, { useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, ScrollView, useSafeAreaInsets } from '@onekeyhq/components';

import { AboutSection } from './AboutSection';
import { GenaralSection } from './GenaralSection';
import { SecuritySection } from './SecuritySection';

export const Settings = () => {
  const navigation = useNavigation();
  const intl = useIntl();
  const insert = useSafeAreaInsets();
  useLayoutEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({
        id: 'title__settings',
      }),
    });
  }, [navigation, intl]);

  return (
    <ScrollView px={4} py={{ base: 6, md: 8 }} bg="background-default">
      <Box w="full" maxW={768} mx="auto" pb={insert.bottom}>
        <GenaralSection />
        <SecuritySection />
        <AboutSection />
      </Box>
    </ScrollView>
  );
};

export default Settings;

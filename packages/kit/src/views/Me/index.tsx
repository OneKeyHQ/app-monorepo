import { Box, ScrollView, useSafeAreaInsets } from '@onekeyhq/components';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import HelpSelector from '../Help/HelpSelector';

import { AboutSection } from './AboutSection';
import { AdvancedSection } from './AdvancedSection';
import { DefaultSection } from './DefaultSection';
import { DevSettingSection } from './DevSetting';
import { FooterAction } from './FooterSection';
import { GenaralSection } from './GenaralSection';
import { HardwareBridgeSection } from './HardwareBridgeSection';
import { PushSection } from './PushSection';
import { SecuritySection } from './SecuritySection';
import { UtilSection } from './UtilSection';

export const Me = (options: any) => {
  // useHideTabNavigatorHeader();
  const { enable: devModeEnable } = useSettings().devMode || {};

  console.log('Me screen options >>>>', options);
  const inset = useSafeAreaInsets();

  return (
    <Box bg="background-default" flex="1">
      <ScrollView px={4} py={{ base: 6, md: 8 }} bg="background-default">
        <Box w="full" maxW={768} mx="auto" pb={`${inset.bottom}px`}>
          <UtilSection />
          <DefaultSection />
          <GenaralSection />
          <SecuritySection />
          <PushSection />
          <AdvancedSection />
          <AboutSection />
          <HardwareBridgeSection />
          <FooterAction />
          {devModeEnable ? <DevSettingSection /> : null}
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

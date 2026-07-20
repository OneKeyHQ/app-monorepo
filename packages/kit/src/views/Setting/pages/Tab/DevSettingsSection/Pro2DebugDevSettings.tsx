import { ESwitchSize, Switch } from '@onekeyhq/components';

import { SectionFieldItem } from './SectionFieldItem';

export function Pro2DebugDevSettings() {
  return (
    <>
      <SectionFieldItem
        icon="OnekeyDeviceCustom"
        name="enablePro2TestMode"
        title="Enable Pro 2 Debug Foundation"
        subtitle="Master switch for experimental Pro 2 modules and Protocol V2 flows"
        testID="enable-pro2-test-mode"
        searchKeywords="Pro2 protocol v2 hardware testing master"
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>

      <SectionFieldItem
        icon="OnekeyDeviceCustom"
        name="enablePro2OnboardingDev"
        title="Enable Pro 2 Onboarding"
        subtitle="Expose the Pro 2 onboarding entry and Protocol V2 connection flow"
        testID="enable-pro2-onboarding"
        searchKeywords="Pro2 onboarding protocol v2 hardware testing"
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>

      <SectionFieldItem
        icon="OnekeyDeviceCustom"
        name="enablePortfolioSyncDev"
        title="Enable Pro 2 Portfolio Sync"
        subtitle="Enable Pro 2 portfolio package synchronization"
        testID="enable-portfolio-sync"
        searchKeywords="Pro2 portfolio hardware sync package"
      >
        <Switch size={ESwitchSize.small} />
      </SectionFieldItem>
    </>
  );
}

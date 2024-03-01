import { Page, ScrollView, Stack } from '@onekeyhq/components';

import { AboutSection } from './AboutSection';
import { AdvancedSection } from './AdvancedSection';
import { DataSection } from './DataSection';
import { DevSettingsSection } from './DevSettingsSection';
import { PreferenceSection } from './PreferenceSection';
import { SecuritySection } from './SecuritySection';

export default function SettingListModal() {
  return (
    <Page>
      <ScrollView>
        <Stack pb="$2">
          <SecuritySection />
          <PreferenceSection />
          <DataSection />
          <AdvancedSection />
          <AboutSection />
          <DevSettingsSection />
        </Stack>
      </ScrollView>
    </Page>
  );
}

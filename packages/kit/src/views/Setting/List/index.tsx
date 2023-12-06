import { Page, ScrollView, Stack } from '@onekeyhq/components';

import { AboutSection } from './AboutSection';
import { CryptoCurrencySection } from './CryptoCurrencySection';
import { DataSection } from './DataSection';
import { HardwareBridgeSection } from './HardwareBridgeSection';
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
          <CryptoCurrencySection />
          <HardwareBridgeSection />
          <AboutSection />
        </Stack>
      </ScrollView>
    </Page>
  );
}

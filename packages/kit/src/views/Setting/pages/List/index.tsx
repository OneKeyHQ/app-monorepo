import { Page, ScrollView, Stack } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

import { AboutSection } from './AboutSection';
import { CryptoCurrencySection } from './CryptoCurrencySection';
import { DataSection } from './DataSection';
import { DevSettingsSection } from './DevSettingsSection';
import { HardwareBridgeSection } from './HardwareBridgeSection';
import { PreferenceSection } from './PreferenceSection';
import { SecuritySection } from './SecuritySection';

export default function SettingListModal() {
  const [settings] = useDevSettingsPersistAtom();

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
          {settings.enabled && <DevSettingsSection />}
        </Stack>
      </ScrollView>
    </Page>
  );
}

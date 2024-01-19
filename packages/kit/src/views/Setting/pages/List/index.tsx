import { useMemo } from 'react';

import { Page, ScrollView, Stack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { AboutSection } from './AboutSection';
import { CryptoCurrencySection } from './CryptoCurrencySection';
import { DataSection } from './DataSection';
import { DevModeSection } from './DevModeSection';
import { HardwareBridgeSection } from './HardwareBridgeSection';
import { PreferenceSection } from './PreferenceSection';
import { SecuritySection } from './SecuritySection';

export default function SettingListModal() {
  const [settings] = useSettingsPersistAtom();

  const content = useMemo(() => {
    console.log('SettingListModal useMemo');
    return 'hello world';
  }, []);

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
          {settings.devMode.enable && <DevModeSection />}
        </Stack>
      </ScrollView>
    </Page>
  );
}

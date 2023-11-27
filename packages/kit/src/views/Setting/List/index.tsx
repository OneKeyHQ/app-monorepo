import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ListItem,
  Page,
  ScrollView,
  Stack,
  Switch,
} from '@onekeyhq/components';

import { AboutSection } from './AboutSection';
import { DataSection } from './DataSection';
import { PreferenceSection } from './PreferenceSection';
import { Section } from './Section';

const SecuritySection = () => {
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  const [val, setVal] = useState(false);

  return (
    <Section title="SECURITY">
      <ListItem
        icon="FaceIdOutline"
        title={intl.formatMessage({ id: 'content__face_id' })}
      >
        <Switch value={val} onChange={setVal} />
      </ListItem>
      <ListItem
        onPress={onPress}
        icon="LockOutline"
        title={intl.formatMessage({ id: 'form__app_lock' })}
        drillIn
      >
        <ListItem.Text
          primary="Never"
          align="right"
          primaryTextProps={{
            tone: 'subdued',
          }}
        />
      </ListItem>
      <ListItem
        onPress={onPress}
        icon="KeyOutline"
        title={intl.formatMessage({ id: 'form__change_password' })}
        drillIn
      />
    </Section>
  );
};

const CryptoCurrencySection = () => {
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  return (
    <Section title="CRYPTOCURRENCY">
      <ListItem
        onPress={onPress}
        icon="CryptoCoinOutline"
        title={intl.formatMessage({ id: 'form__spend_dust_utxo' })}
        drillIn
      />
      <ListItem
        onPress={onPress}
        icon="AlbumsOutline"
        title="Account derivation"
        drillIn
      />
    </Section>
  );
};

const HardwareBridgeSection = () => {
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  return (
    <Section title="HARDWARE BRIDGE">
      <ListItem
        onPress={onPress}
        icon="CodeOutline"
        title={intl.formatMessage({ id: 'form__hardware_bridge_sdk_url' })}
        drillIn
      />
      <ListItem
        onPress={onPress}
        icon="ChartTrendingOutline"
        title={intl.formatMessage({ id: 'form__hardware_bridge_status' })}
      >
        <ListItem.IconButton
          disabled
          icon="ArrowTopRightOutline"
          iconProps={{
            color: '$iconActive',
          }}
        />
      </ListItem>
    </Section>
  );
};

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

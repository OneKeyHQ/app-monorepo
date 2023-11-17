import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ListItem,
  ModalContainer,
  ScrollView,
  Stack,
  Switch,
} from '@onekeyhq/components';

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

const DataSection = () => {
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  return (
    <Section title="PREFERENCE">
      <ListItem
        onPress={onPress}
        icon="BroomOutline"
        title="Clear cache on App"
      />
      <ListItem
        onPress={onPress}
        icon="CompassOutline"
        title="Clear cache of web browser"
      />
      <ListItem
        onPress={onPress}
        icon="Document2Outline"
        title={intl.formatMessage({ id: 'content__state_logs' })}
      >
        <ListItem.IconButton
          disabled
          icon="DownloadOutline"
          iconProps={{
            color: '$iconActive',
          }}
        />
      </ListItem>
      <ListItem
        iconProps={{ color: '$textCritical' }}
        onPress={onPress}
        icon="DeleteOutline"
        title={intl.formatMessage({ id: 'action__erase_data' })}
        titleProps={{ color: '$textCritical' }}
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

const AboutSection = () => {
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  return (
    <Section title="ABOUT">
      <ListItem
        onPress={onPress}
        icon="InfoCircleOutline"
        title={intl.formatMessage({ id: 'form__version' })}
        drillIn
      >
        <ListItem.Text
          primary="4.15"
          align="right"
          primaryTextProps={{
            tone: 'subdued',
          }}
        />
      </ListItem>
      <ListItem
        onPress={onPress}
        icon="ThumbUpOutline"
        title={intl.formatMessage({ id: 'form__rate_our_app' })}
      >
        <ListItem.IconButton
          disabled
          icon="ArrowTopRightOutline"
          iconProps={{
            color: '$iconActive',
          }}
        />
      </ListItem>
      <ListItem
        onPress={onPress}
        icon="HelpSupportOutline"
        title={intl.formatMessage({ id: 'title__help_center' })}
      >
        <ListItem.IconButton
          disabled
          icon="ArrowTopRightOutline"
          iconProps={{
            color: '$iconActive',
          }}
        />
      </ListItem>
      <ListItem onPress={onPress} icon="EditOutline" title="Submit ticket">
        <ListItem.IconButton
          disabled
          icon="ArrowTopRightOutline"
          iconProps={{
            color: '$iconActive',
          }}
        />
      </ListItem>
      <ListItem
        onPress={onPress}
        icon="AddedPeopleOutline"
        title={intl.formatMessage({ id: 'form__user_agreement' })}
        drillIn
      />
      <ListItem
        onPress={onPress}
        icon="Shield2CheckOutline"
        title={intl.formatMessage({ id: 'terms__privacy_policy' })}
        drillIn
      />
    </Section>
  );
};

export default function SettingListModal() {
  return (
    <ModalContainer>
      <ScrollView>
        <Stack>
          <SecuritySection />
          <PreferenceSection />
          <DataSection />
          <CryptoCurrencySection />
          <HardwareBridgeSection />
          <AboutSection />
        </Stack>
      </ScrollView>
    </ModalContainer>
  );
}

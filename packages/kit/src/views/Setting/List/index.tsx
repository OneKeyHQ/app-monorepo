import { useCallback, useState } from 'react';

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
  const [val, setVal] = useState(false);
  return (
    <Section title="SECURITY">
      <ListItem icon="FaceIdOutline" title="Face ID">
        <Switch value={val} onChange={setVal} />
      </ListItem>
      <ListItem onPress={onPress} icon="LockOutline" title="Auto-lock" drillIn>
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
        title="Change password"
        drillIn
      />
    </Section>
  );
};

const DataSection = () => {
  const onPress = useCallback(() => {}, []);
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
      <ListItem onPress={onPress} icon="Document2Outline" title="State logs">
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
        title="Erase data"
        titleProps={{ color: '$textCritical' }}
      />
    </Section>
  );
};

const CryptoCurrencySection = () => {
  const onPress = useCallback(() => {}, []);
  return (
    <Section title="CRYPTOCURRENCY">
      <ListItem
        onPress={onPress}
        icon="CryptoCoinOutline"
        title="Spend Dust UTXO"
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
  return (
    <Section title="HARDWARE BRIDGE">
      <ListItem
        onPress={onPress}
        icon="CodeOutline"
        title="Hardware SDK URL"
        drillIn
      />
      <ListItem
        onPress={onPress}
        icon="ChartTrendingOutline"
        title="Hardware bridge status"
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
  return (
    <Section title="ABOUT">
      <ListItem
        onPress={onPress}
        icon="InfoCircleOutline"
        title="Version"
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
      <ListItem onPress={onPress} icon="ThumbUpOutline" title="Rate the App">
        <ListItem.IconButton
          disabled
          icon="ArrowTopRightOutline"
          iconProps={{
            color: '$iconActive',
          }}
        />
      </ListItem>
      <ListItem onPress={onPress} icon="HelpSupportOutline" title="Help center">
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
        title="User agreement"
        drillIn
      />
      <ListItem
        onPress={onPress}
        icon="Shield2CheckOutline"
        title="Privacy policy"
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

import { useCallback, useState } from 'react';
import type { FC, ReactNode } from 'react';

import {
  ListItem,
  ModalContainer,
  ScrollView,
  Stack,
  Switch,
  Text,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';

import type { IModalSettingParamList } from '../types';

type ISectionProps = {
  title: string;
  children: ReactNode;
};

const Section: FC<ISectionProps> = ({ title, children }) => (
  <Stack>
    <Text
      variant="$headingSm"
      paddingHorizontal="$4"
      paddingBottom="$2"
      paddingTop="$5"
      color="$textSubdued"
    >
      {title}
    </Text>
    <Stack>{children}</Stack>
  </Stack>
);

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

const PreferenceSection = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingCurrencyModal,
    });
  }, [navigation]);
  const onTheme = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingThemeModal,
    });
  }, [navigation]);
  const onLanguage = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingLanguageModal,
    });
  }, [navigation]);
  return (
    <Section title="PREFERENCE">
      <ListItem
        icon="DollarOutline"
        title="Default currency"
        drillIn
        onPress={onPress}
      >
        <ListItem.Text
          primary="USD"
          align="right"
          primaryTextProps={{
            tone: 'subdued',
          }}
        />
      </ListItem>
      <ListItem
        onPress={onLanguage}
        icon="GlobusOutline"
        title="Language"
        drillIn
      >
        <ListItem.Text
          primary="English"
          align="right"
          primaryTextProps={{
            tone: 'subdued',
          }}
        />
      </ListItem>
      <ListItem onPress={onTheme} icon="PaletteOutline" title="Theme" drillIn>
        <ListItem.Text
          primary="Auto"
          align="right"
          primaryTextProps={{
            tone: 'subdued',
          }}
        />
      </ListItem>
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

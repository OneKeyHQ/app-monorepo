import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { ListItem, Switch } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';

import { Section } from './Section';

import type { IModalSettingParamList } from '../types';

const AppLockItem = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingAppLockModal,
    });
  }, [navigation]);
  const intl = useIntl();
  return (
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
  );
};

const ChangePasswordItem = () => {
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  return (
    <ListItem
      onPress={onPress}
      icon="KeyOutline"
      title={intl.formatMessage({ id: 'form__change_password' })}
      drillIn
    />
  );
};

export const SecuritySection = () => {
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
      <AppLockItem />
      <ChangePasswordItem />
    </Section>
  );
};

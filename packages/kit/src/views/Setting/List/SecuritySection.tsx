import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, ListItem, Switch, Toast } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import PasswordSetupContainer from '@onekeyhq/kit/src/components/Password/container/PasswordSetupContainer';
import PasswordUpdateContainer from '@onekeyhq/kit/src/components/Password/container/PasswordUpdateContainer';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

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

const SetPasswordItem = () => {
  const intl = useIntl();
  const onPress = useCallback(() => {
    const dialog = Dialog.confirm({
      title: intl.formatMessage({ id: 'title__set_password' }),
      renderContent: (
        <PasswordSetupContainer
          onSetupRes={(data) => {
            console.log('setup data', data);
            if (data) {
              Toast.success({ title: '设置成功' });
              dialog.close();
            }
          }}
        />
      ),
      showFooter: false,
    });
  }, [intl]);
  return (
    <ListItem
      onPress={onPress}
      icon="KeyOutline"
      title={intl.formatMessage({ id: 'title__set_password' })}
    />
  );
};

const ChangePasswordItem = () => {
  const intl = useIntl();
  const onPress = useCallback(() => {
    const dialog = Dialog.confirm({
      title: intl.formatMessage({ id: 'form__change_password' }),
      renderContent: (
        <PasswordUpdateContainer
          onUpdateRes={(data) => {
            console.log('update data', data);
            if (data) {
              Toast.success({ title: '修改成功' });
              dialog.close();
            }
          }}
        />
      ),
      showFooter: false,
    });
  }, [intl]);
  return (
    <ListItem
      onPress={onPress}
      icon="KeyOutline"
      title={intl.formatMessage({ id: 'form__change_password' })}
    />
  );
};

const PasswordItem = () => {
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  return isPasswordSet ? <ChangePasswordItem /> : <SetPasswordItem />;
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
      <PasswordItem />
    </Section>
  );
};

import { Suspense, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, ListItem, Toast } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import { UniversalContainer } from '@onekeyhq/kit/src/components/BiologyAuthComponent/container/UniversalContainer';
import PasswordSetupContainer from '@onekeyhq/kit/src/components/Password/container/PasswordSetupContainer';
import PasswordUpdateContainer from '@onekeyhq/kit/src/components/Password/container/PasswordUpdateContainer';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';
import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordPersistAtom,
  usePasswordWebAuthInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import { Section } from './Section';

import type { IModalSettingParamList } from '../types';

const AppLockItem = () => {
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingAppLockModal,
    });
  }, [navigation]);
  const intl = useIntl();
  return isPasswordSet ? (
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
  ) : null;
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

const FaceIdItem = () => {
  const intl = useIntl();
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  const [{ isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();

  return isPasswordSet && (biologyAuthIsSupport || webAuthIsSupport) ? (
    <ListItem
      icon="FaceIdOutline"
      title={intl.formatMessage({ id: 'content__face_id' })}
    >
      <UniversalContainer />
    </ListItem>
  ) : null;
};

export const SecuritySection = () => (
  <Section title="SECURITY">
    <FaceIdItem />
    <AppLockItem />
    <PasswordItem />
  </Section>
);

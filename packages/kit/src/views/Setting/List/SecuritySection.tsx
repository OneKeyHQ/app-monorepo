import type { ComponentProps } from 'react';
import { Suspense, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, ListItem, Toast } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { UniversalContainerWithSuspense } from '@onekeyhq/kit/src/components/BiologyAuthComponent/container/UniversalContainer';
import PasswordSetupContainer from '@onekeyhq/kit/src/components/Password/container/PasswordSetupContainer';
import PasswordUpdateContainer from '@onekeyhq/kit/src/components/Password/container/PasswordUpdateContainer';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordPersistAtom,
  usePasswordWebAuthInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import { useDurationOptions } from '../AppLock/useDurationOptions';

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
  const [settings] = useSettingsPersistAtom();
  const options = useDurationOptions();
  const text = useMemo(() => {
    const option = options.find(
      (item) => item.value === String(settings.appLockDuration),
    );
    return option?.title ?? '';
  }, [options, settings]);
  return isPasswordSet ? (
    <ListItem
      onPress={onPress}
      icon="LockOutline"
      title={intl.formatMessage({ id: 'form__app_lock' })}
      drillIn
    >
      <ListItem.Text
        primary={text}
        align="right"
        primaryTextProps={{
          // tone: 'subdued',
        }}
      />
    </ListItem>
  ) : null;
};

const SetPasswordItem = () => {
  const intl = useIntl();
  const onPress = useCallback(() => {
    const dialog = Dialog.show({
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
    const dialog = Dialog.show({
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
  const [{ isSupport: biologyAuthIsSupport, authType }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();

  let title = intl.formatMessage({ id: 'form__touch_id' });
  let icon: ComponentProps<typeof ListItem>['icon'] = 'TouchIdSolid';
  if (biologyAuthIsSupport) {
    if (authType.includes(2)) {
      title = intl.formatMessage({ id: 'content__face_id' });
      icon = 'FaceIdSolid';
    }
  }

  return isPasswordSet && (biologyAuthIsSupport || webAuthIsSupport) ? (
    <ListItem icon={icon} title={title}>
      <UniversalContainerWithSuspense />
    </ListItem>
  ) : null;
};

const ProtectionItem = () => {
  const intl = useIntl();
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingProtectModal,
    });
  }, [navigation]);
  return isPasswordSet ? (
    <ListItem
      onPress={onPress}
      icon="ShieldCheckDoneOutline"
      title={intl.formatMessage({ id: 'action__protection' })}
      drillIn
    />
  ) : null;
};

export const SecuritySection = () => {
  const intl = useIntl();
  return (
    <Section title={intl.formatMessage({ id: 'form__security_uppercase' })}>
      <Suspense fallback={null}>
        <FaceIdItem />
      </Suspense>
      <AppLockItem />
      <PasswordItem />
      <ProtectionItem />
    </Section>
  );
};

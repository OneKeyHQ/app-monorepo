import { Suspense, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { UniversalContainerWithSuspense } from '@onekeyhq/kit/src/components/BiologyAuthComponent/container/UniversalContainer';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import PasswordUpdateContainer from '@onekeyhq/kit/src/components/Password/container/PasswordUpdateContainer';
import { Section } from '@onekeyhq/kit/src/components/Section';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBiometricAuthInfo } from '@onekeyhq/kit/src/hooks/useBiometricAuthInfo';
import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordPersistAtom,
  usePasswordWebAuthInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes';
import {
  EDAppConnectionModal,
  EModalRoutes,
  EModalSettingRoutes,
} from '@onekeyhq/shared/src/routes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { useOptions } from '../../AppAutoLock/useOptions';

import { CleanDataItem } from './CleanDataItem';

const AppAutoLockItem = () => {
  const [{ isPasswordSet, appLockDuration }] = usePasswordPersistAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingAppAutoLockModal);
  }, [navigation]);
  const intl = useIntl();
  const options = useOptions();
  const text = useMemo(() => {
    const option = options.find(
      (item) => item.value === String(appLockDuration),
    );
    return option?.title ?? '';
  }, [options, appLockDuration]);
  return isPasswordSet ? (
    <ListItem
      onPress={onPress}
      icon="ClockTimeHistoryOutline"
      title={intl.formatMessage({ id: ETranslations.settings_auto_lock })}
      drillIn
    >
      <ListItem.Text primary={text} align="right" />
    </ListItem>
  ) : null;
};

const SetPasswordItem = () => {
  const intl = useIntl();
  return (
    <ListItem
      testID="setting-set-password"
      onPress={() => {
        void backgroundApiProxy.servicePassword.promptPasswordVerify();
      }}
      icon="KeyOutline"
      title={intl.formatMessage({ id: ETranslations.global_set_password })}
      drillIn
    />
  );
};

const ChangePasswordItem = () => {
  const intl = useIntl();
  const onPress = useCallback(async () => {
    const oldEncodedPassword =
      await backgroundApiProxy.servicePassword.promptPasswordVerify({
        reason: EReasonForNeedPassword.Security,
      });
    const dialog = Dialog.show({
      title: intl.formatMessage({ id: ETranslations.global_change_password }),
      renderContent: (
        <PasswordUpdateContainer
          oldEncodedPassword={oldEncodedPassword.password}
          onUpdateRes={async (data) => {
            if (data) {
              await dialog.close();
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
      title={intl.formatMessage({ id: ETranslations.global_change_password })}
      drillIn
    />
  );
};

const PasswordItem = () => {
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  return isPasswordSet ? <ChangePasswordItem /> : <SetPasswordItem />;
};

const FaceIdItem = () => {
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  const [{ isSupport: biologyAuthIsSupport, authType }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();
  const { title, icon } = useBiometricAuthInfo();

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
    navigation.push(EModalSettingRoutes.SettingProtectModal);
  }, [navigation]);
  return isPasswordSet ? (
    <ListItem
      onPress={onPress}
      icon="ShieldCheckDoneOutline"
      title={intl.formatMessage({ id: ETranslations.settings_protection })}
      drillIn
    />
  ) : null;
};

const ConnectedSitesItem = () => {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.DAppConnectionModal, {
      screen: EDAppConnectionModal.ConnectionList,
    });
  }, [navigation]);
  return (
    <ListItem
      title={intl.formatMessage({ id: ETranslations.settings_connected_sites })}
      icon="LinkOutline"
      drillIn
      onPress={onPress}
    />
  );
};

const SignatureRecordItem = () => {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingSignatureRecordModal);
  }, [navigation]);
  return (
    <ListItem
      onPress={onPress}
      icon="NoteOutline"
      title={intl.formatMessage({
        id: ETranslations.settings_signature_record,
      })}
      drillIn
    />
  );
};

export const SecuritySection = () => {
  const intl = useIntl();
  return (
    <Section title={intl.formatMessage({ id: ETranslations.global_security })}>
      <Suspense fallback={null}>
        <FaceIdItem />
      </Suspense>
      <AppAutoLockItem />
      <PasswordItem />
      {!platformEnv.isWebDappMode ? <ConnectedSitesItem /> : null}
      <SignatureRecordItem />
      <ProtectionItem />
      <CleanDataItem />
    </Section>
  );
};

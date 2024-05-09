import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Dialog, Page, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ITabMeParamList } from '@onekeyhq/shared/src/routes';
import {
  EDAppConnectionModal,
  EModalRoutes,
  EModalSettingRoutes,
  EOnboardingPages,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import extUtils, { EXT_HTML_FILES } from '@onekeyhq/shared/src/utils/extUtils';

import useAppNavigation from '../../../hooks/useAppNavigation';

const AddressBookHashButton = () => {
  const onPress = useCallback(async () => {
    Dialog.show({
      title: 'Tamper Address Book',
      description:
        'This is a feature specific to development environments. Function used to simulate address data being tampered with',
      confirmButtonProps: {
        variant: 'destructive',
      },
      onConfirm: () => {
        void backgroundApiProxy.serviceAddressBook.__dangerTamperVerifyHashForTest();
      },
    });
  }, []);
  return (
    <Button onPress={onPress} testID="temper-address-book">
      Tamper Address Book
    </Button>
  );
};

const TabMe = () => {
  const intl = useIntl();
  const navigation = useAppNavigation<IPageNavigationProp<ITabMeParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);
  const onExpand = useCallback(() => {
    extUtils.openUrlInTab(EXT_HTML_FILES.uiExpandTab).catch(console.error);
  }, []);
  return (
    <Page>
      <Page.Body>
        <YStack px="$2" space="$2">
          <Button
            onPress={() => {
              navigation.switchTab(ETabRoutes.Home);
            }}
          >
            切换到首页
          </Button>
          <Button
            onPress={() => {
              navigation.pushFullModal(EModalRoutes.OnboardingModal, {
                screen: EOnboardingPages.GetStarted,
              });
            }}
          >
            Onboarding
          </Button>
          <Button onPress={onPress} testID="me-settings">
            {intl.formatMessage({ id: 'title__settings' })}
          </Button>
          <AddressBookHashButton />
          {platformEnv.isExtensionUiPopup ? (
            <Button onPress={onExpand}>
              {intl.formatMessage({ id: 'action__expand' })}
            </Button>
          ) : null}
          <Button
            onPress={() => {
              void backgroundApiProxy.servicePassword.clearCachedPassword();
            }}
          >
            清空缓存密码
          </Button>
          <Button
            onPress={() => {
              void backgroundApiProxy.serviceE2E.resetPasswordSetStatus();
            }}
          >
            重置密码设置
          </Button>

          <Button
            onPress={() => {
              navigation.pushModal(EModalRoutes.DAppConnectionModal, {
                screen: EDAppConnectionModal.ConnectionList,
              });
            }}
          >
            DApp 连接管理
          </Button>
        </YStack>
      </Page.Body>
    </Page>
  );
};

function TabMeContainer() {
  return <TabMe />;
}

export default TabMeContainer;

import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page, SizableText, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';
import {
  usePasswordPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils, { EXT_HTML_FILES } from '@onekeyhq/shared/src/utils/extUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProvider } from '../../../components/AccountSelector';
import { CreateHdWalletForm } from '../../../components/AccountSelector/CreateHdWalletForm';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { EOnboardingPages } from '../../../views/Onboarding/router/type';
import { EModalRoutes } from '../../Modal/type';
import { ETabRoutes } from '../type';

import type { ITabMeParamList } from './type';

const SwitchEndpointButton = () => {
  const [settings] = useSettingsPersistAtom();
  const onToggleEndpoint = useCallback(async () => {
    await backgroundApiProxy.serviceSetting.setEndpointType(
      settings.endpointType === 'prod' ? 'test' : 'prod',
    );
  }, [settings.endpointType]);
  return (
    <Button onPress={onToggleEndpoint}>
      Toggle Endpoint (current is {settings.endpointType})
    </Button>
  );
};

const LockNowButton = () => {
  const intl = useIntl();
  const [passwordSetting] = usePasswordPersistAtom();
  const onLock = useCallback(async () => {
    if (passwordSetting.isPasswordSet) {
      await backgroundApiProxy.servicePassword.lockApp();
    } else {
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
      await backgroundApiProxy.servicePassword.lockApp();
    }
  }, [passwordSetting.isPasswordSet]);
  return (
    <Button onPress={onLock}>
      {intl.formatMessage({ id: 'action__lock_now' })}
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
  const { activeAccount } = useActiveAccount({ num: 0 });
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
          <Button onPress={onPress}>
            {intl.formatMessage({ id: 'title__settings' })}
          </Button>
          <LockNowButton />
          {platformEnv.isExtensionUiPopup ? (
            <Button onPress={onExpand}>
              {intl.formatMessage({ id: 'action__expand' })}
            </Button>
          ) : null}
          <SwitchEndpointButton />
          <CreateHdWalletForm />
          <Button
            onPress={() => {
              void backgroundApiProxy.servicePassword.clearCachedPassword();
            }}
          >
            清空缓存密码
          </Button>
          <Button
            onPress={() => {
              void backgroundApiProxy.serviceSend.demoSend({
                networkId: activeAccount.network?.id || '',
                accountId: activeAccount.account?.id || '',
              });
            }}
          >
            测试发送流程(使用首页的账户选择器)
          </Button>
          <SizableText>
            {activeAccount.network?.id}, {activeAccount.account?.id}
          </SizableText>
        </YStack>
      </Page.Body>
    </Page>
  );
};

function TabMeContainer() {
  return (
    <AccountSelectorProvider
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <TabMe />
    </AccountSelectorProvider>
  );
}

export default TabMeContainer;

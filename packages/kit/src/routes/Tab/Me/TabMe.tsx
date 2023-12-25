import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils, { EXT_HTML_FILES } from '@onekeyhq/shared/src/utils/extUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProvider } from '../../../components/AccountSelector';
import { CreateHdWalletForm } from '../../../components/AccountSelector/CreateHdWalletForm';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { EOnboardingPages } from '../../../views/Onboarding/router/type';
import { EModalRoutes } from '../../Modal/type';
import { ETabRoutes } from '../type';

import type { ITabMeParamList } from './type';

const TabMe = () => {
  const intl = useIntl();
  const [settings] = usePasswordPersistAtom();
  const navigation = useAppNavigation<IPageNavigationProp<ITabMeParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);
  const onLock = useCallback(() => {
    backgroundApiProxy.servicePassword.lockApp().catch(console.error);
  }, []);
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
          {settings.isPasswordSet ? (
            <Button onPress={onLock}>
              {intl.formatMessage({ id: 'action__lock_now' })}
            </Button>
          ) : null}
          {platformEnv.isExtensionUiPopup ? (
            <Button onPress={onExpand}>
              {intl.formatMessage({ id: 'action__expand' })}
            </Button>
          ) : null}

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
                networkId: 'evm--5',
                accountId: `hd-1--m/44'/60'/0'/0/0`,
              });
            }}
          >
            测试发送流程 EVM
          </Button>
          <Button
            onPress={() => {
              void backgroundApiProxy.serviceSend.demoSend({
                networkId: 'btc--0',
                accountId: `hd-1--m/44'/60'/0'/0/0`,
              });
            }}
          >
            测试发送流程 BTC
          </Button>
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

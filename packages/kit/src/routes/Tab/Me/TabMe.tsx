import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page, YStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProvider } from '../../../components/AccountSelector';
import { CreateHdWalletForm } from '../../../components/AccountSelector/CreateHdWalletForm';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../Modal/type';
import { ETabRoutes } from '../type';

import type { ITabMeParamList } from './type';

const TabMe = () => {
  const intl = useIntl();
  const navigation = useAppNavigation<IPageNavigationProp<ITabMeParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);
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
          <Button onPress={onPress}>
            {intl.formatMessage({ id: 'title__settings' })}
          </Button>

          <CreateHdWalletForm />
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

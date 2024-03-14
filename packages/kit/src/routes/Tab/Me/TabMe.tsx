import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Page,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAddressBookList } from '@onekeyhq/kit/src/views/AddressBook/hooks/useAddressBook';
import { useAddressBookPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDAppConnectionModal,
  EModalRoutes,
  EModalSettingRoutes,
  EOnboardingPages,
} from '@onekeyhq/shared/src/routes';
import extUtils, { EXT_HTML_FILES } from '@onekeyhq/shared/src/utils/extUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { ETabRoutes } from '../type';

import type { ITabMeParamList } from './type';

const AddressBookButton = () => {
  const intl = useIntl();
  const pick = useAddressBookList();
  const [{ updateTimestamp }] = useAddressBookPersistAtom();
  const onPress = useCallback(async () => {
    if (!updateTimestamp) {
      Dialog.show({
        title: 'Encrypted storage',
        icon: 'PlaceholderOutline',
        description:
          'All your address book data is encrypted with your login password. ',
        tone: 'default',
        showConfirmButton: true,
        showCancelButton: true,
        onConfirm: async (inst) => {
          await inst.close();
          await pick();
        },
        confirmButtonProps: {
          testID: 'encrypted-storage-confirm',
        },
      });
    } else {
      await pick();
    }
  }, [pick, updateTimestamp]);
  return (
    <Button onPress={onPress} testID="me-address-book">
      {intl.formatMessage({ id: 'title__address_book' })}
    </Button>
  );
};

const AddressBookHashButton = () => {
  const onPress = useCallback(async () => {
    void backgroundApiProxy.serviceAddressBook.__dangerTamperVerifyHashForTest();
  }, []);
  return (
    <Button onPress={onPress} testID="temper-address-book">
      Tamper Address Book
    </Button>
  );
};

function TestRefreshCmp() {
  const {
    activeAccount: { accountName },
  } = useActiveAccount({ num: 0 });
  console.log('TestRefresh refresh', accountName);
  return <Button>TestRefresh: {accountName}</Button>;
}
const TestRefresh = memo(TestRefreshCmp);

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
          <Button onPress={onPress} testID="me-settings">
            {intl.formatMessage({ id: 'title__settings' })}
          </Button>
          <AddressBookButton />
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
            onPress={async () => {
              const r = await backgroundApiProxy.serviceSend.demoSend({
                networkId: activeAccount.network?.id || '',
                accountId: activeAccount.account?.id || '',
              });
              console.log('demoSend done:', r);
            }}
          >
            测试发送流程(使用首页的账户选择器)
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
          <SizableText>
            {activeAccount.network?.id}, {activeAccount.account?.id}
          </SizableText>
          <TestRefresh />
        </YStack>
      </Page.Body>
    </Page>
  );
};

function TabMeContainer() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <TabMe />
    </AccountSelectorProviderMirror>
  );
}

export default TabMeContainer;

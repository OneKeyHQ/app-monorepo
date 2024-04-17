import { memo, useCallback, useRef } from 'react';

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
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

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

const SignMessageButton = () => {
  const ref = useRef<number>(0);
  const onPress = useCallback(async () => {
    Dialog.show({
      title: 'Sign Message',
      description: 'Function used to simulate sign Message',
      confirmButtonProps: {
        variant: 'destructive',
      },
      onConfirm: () => {
        ref.current += 1;
        void backgroundApiProxy.serviceSignature.addSignedMessage({
          networkId: 'evm--1',
          address: '0xec766119A2021956773F16Cf77A3B248FF79b1c7',
          message: 'hello world',
          contentType: 'text',
          title: `Sign Message Test ${ref.current}`,
        });
      },
    });
  }, []);
  return <Button onPress={onPress}>Mock Signature SignMessage</Button>;
};

const SignTransactionButton = () => {
  const ref = useRef<number>(0);
  const onPress = useCallback(async () => {
    Dialog.show({
      title: 'Sign Message',
      confirmButtonProps: {
        variant: 'destructive',
      },
      onConfirm: () => {
        ref.current += 1;
        void backgroundApiProxy.serviceSignature.addSignedTransaction({
          networkId: 'evm--1',
          title: `OneKey Wallet ${ref.current}`,
          hash: '0x866c4749db18695e4359f4e3f121a835d7715638315427e5521bcd078724d0d1',
          address: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
          data: {
            type: 'send',
            amount: '100000',
            token: {
              name: 'USD Coin',
              symbol: 'USDC',
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            },
          },
        });
      },
    });
  }, []);
  return <Button onPress={onPress}>Mock Signature Sign Transaction</Button>;
};

const ConnectSiteButton = () => {
  const onPress = useCallback(async () => {
    Dialog.show({
      title: 'Connect Site',
      confirmButtonProps: {
        variant: 'destructive',
      },
      onConfirm: () => {
        void backgroundApiProxy.serviceSignature.addConnectedSite({
          url: 'https://app.uniswap.org/swap',
          title: 'Uniswap',
          items: [
            {
              networkId: 'evm--1',
              address: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
            },
            {
              networkId: 'evm--56',
              address: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
            },
          ],
        });
      },
    });
  }, []);
  return <Button onPress={onPress}>Mock Signature Connected Site</Button>;
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
          <SignMessageButton />
          <SignTransactionButton />
          <ConnectSiteButton />
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

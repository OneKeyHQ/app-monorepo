import type { ReactNode } from 'react';
import { memo, useCallback, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Button,
  Page,
  ScrollView,
  SizableText,
  Stack,
  TextArea,
  YStack,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { TabletHomeContainer } from '@onekeyhq/kit/src/components/TabletHomeContainer';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ITabDeveloperParamList } from '@onekeyhq/shared/src/routes';
import {
  EDAppConnectionModal,
  EModalRoutes,
  EModalSettingRoutes,
  ETabDeveloperRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorage';
import extUtils, { EXT_HTML_FILES } from '@onekeyhq/shared/src/utils/extUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import useCookie from '../../../hooks/useCookie';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useV4MigrationActions } from '../../Onboarding/pages/V4Migration/hooks/useV4MigrationActions';

const useStorage = platformEnv.isNative
  ? (key: EAppSyncStorageKeys, initialValue?: boolean) => {
      const [data, setData] = useState(
        initialValue || appStorage.syncStorage.getBoolean(key),
      );
      const setNewData = (value: boolean) => {
        appStorage.syncStorage.set(key, value);
        setData(value);
      };
      return [data, setNewData];
    }
  : useCookie;

function PartContainer({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <YStack>
      <Stack paddingTop="$5" paddingBottom="$2.5">
        <SizableText size="$headingMd">{title}</SizableText>
      </Stack>

      <YStack
        padding="$2.5"
        gap="$5"
        borderColor="$border"
        borderWidth={StyleSheet.hairlineWidth}
        borderRadius="$2"
      >
        {children}
      </YStack>
    </YStack>
  );
}

function ConnectWalletConnectDapp() {
  const [val, setVal] = useState('');
  return (
    <PartContainer title="WalletConnect connect to Dapp">
      <TextArea
        placeholder="walletconnect dapp qrcode uri"
        value={val}
        onChangeText={setVal}
      />
      <Button
        onPress={async () => {
          if (val) {
            await backgroundApiProxy.walletConnect.connectToDapp(val);
            setVal('');
          }
        }}
      >
        Connect
      </Button>
    </PartContainer>
  );
}

function TestButtons() {
  const navigation = useAppNavigation<IPageNavigationProp<any>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);
  const onExpand = useCallback(() => {
    extUtils.openUrlInTab(EXT_HTML_FILES.uiExpandTab).catch(console.error);
  }, []);
  const { navigateToV4MigrationPage } = useV4MigrationActions();

  return (
    <YStack px="$2" py="$2" gap="$2">
      <Button
        onPress={() => {
          navigation.switchTab(ETabRoutes.Home);
        }}
      >
        切换到首页
      </Button>
      <Button onPress={onPress} testID="me-settings">
        设置
      </Button>
      {platformEnv.isExtensionUiPopup ? (
        <Button onPress={onExpand}>全屏</Button>
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
          navigation.pushModal(EModalRoutes.DAppConnectionModal, {
            screen: EDAppConnectionModal.ConnectionList,
          });
        }}
      >
        DApp 连接管理
      </Button>

      <Button
        onPress={() => {
          void navigateToV4MigrationPage();
        }}
      >
        V4 迁移
      </Button>
      <Button
        onPress={() => {
          void navigateToV4MigrationPage({ isAutoStartOnMount: true });
        }}
      >
        V4 迁移（断点恢复模式）
      </Button>
      <Button
        onPress={() => {
          void backgroundApiProxy.serviceAppUpdate.clearLastDialogShownAt();
        }}
      >
        清除更新弹窗时间限制
      </Button>
    </YStack>
  );
}

function TestRefreshCmp() {
  const {
    activeAccount: { accountName },
  } = useActiveAccount({ num: 0 });
  console.log('TestRefresh refresh', accountName);
  return <Button>TestRefresh: {accountName}</Button>;
}
const TestRefresh = memo(TestRefreshCmp);

const TabDeveloper = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<ITabDeveloperParamList>>();

  // @ts-expect-error
  const [rrtStatus, changeRRTStatus] = useStorage(EAppSyncStorageKeys.rrt);

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <Page>
        <Page.Body>
          <ScrollView
            flex={1}
            width="100%"
            paddingHorizontal="$5"
            contentContainerStyle={{ paddingBottom: '$5' }}
            gap="$5"
          >
            <PartContainer title="Components">
              <Button
                onPress={() => {
                  navigation.push(ETabDeveloperRoutes.ComponentsGallery);
                }}
              >
                Gallery
              </Button>
            </PartContainer>

            <PartContainer title="Debug Router & Tabs & List">
              <Button
                onPress={() => {
                  navigation.push(ETabDeveloperRoutes.DevHome);
                }}
              >
                DevHome Page
              </Button>
            </PartContainer>

            <PartContainer title="Debugger Signature Records">
              <Button
                onPress={() => {
                  navigation.push(ETabDeveloperRoutes.SignatureRecord);
                }}
              >
                Signature Records
              </Button>
            </PartContainer>

            <PartContainer title="Debug Tools">
              <Button
                onPress={() => {
                  if (platformEnv.isNative) {
                    (changeRRTStatus as (value: boolean) => void)(!rrtStatus);
                    alert('Please manually restart the app.');
                  } else {
                    const status = rrtStatus === '1' ? '0' : '1';
                    (changeRRTStatus as (value: string) => void)(status);
                    if (platformEnv.isRuntimeBrowser) {
                      if (status === '0') {
                        localStorage.removeItem(
                          '$$OnekeyReactRenderTrackerEnabled',
                        );
                      } else {
                        localStorage.setItem(
                          '$$OnekeyReactRenderTrackerEnabled',
                          'true',
                        );
                      }
                    }
                    globalThis.location.reload();
                  }
                }}
              >
                {platformEnv.isNative ? (
                  <>
                    {rrtStatus
                      ? 'Disabled react-render-tracker'
                      : 'Enabled react-render-tracker'}
                  </>
                ) : (
                  <>
                    {rrtStatus === '1'
                      ? 'Disabled react-render-tracker'
                      : 'Enabled react-render-tracker'}
                  </>
                )}
              </Button>

              {platformEnv.isSupportDesktopBle ? (
                <Button
                  onPress={async () => {
                    await backgroundApiProxy.serviceSetting.setDesktopBluetoothAtom(
                      {
                        isRequestedPermission: false,
                      },
                    );
                    console.log('Reset Bluetooth Permission');
                  }}
                >
                  Reset Bluetooth Permission
                </Button>
              ) : null}

              <Button
                onPress={async () => {
                  try {
                    await backgroundApiProxy.serviceHardware.clearAllBleConnectIdsForTesting();
                    console.log('Successfully cleared all bleConnectId fields');
                  } catch (error) {
                    console.error(
                      'Failed to clear bleConnectId fields:',
                      error,
                    );
                  }
                }}
              >
                Clear All BLE ConnectIds (Test)
              </Button>

              <Button
                onPress={async () => {
                  void backgroundApiProxy.serviceIpTable.init();
                }}
              >
                IP_TABLE_TEST
              </Button>
            </PartContainer>

            <PartContainer title="Async Import Test">
              <Button
                onPress={async () => {
                  const { test } = await import('./asyncImportTest');
                  test();
                }}
              >
                Async Import Test
              </Button>
            </PartContainer>
            <ConnectWalletConnectDapp />
            <TestRefresh />
            {/* <WalletConnectModalNative2 /> */}
            <TestButtons />
          </ScrollView>
        </Page.Body>
      </Page>
    </AccountSelectorProviderMirror>
  );
};

function TabDeveloperContainer() {
  return (
    <TabletHomeContainer>
      <TabDeveloper />
    </TabletHomeContainer>
  );
}
export default TabDeveloperContainer;

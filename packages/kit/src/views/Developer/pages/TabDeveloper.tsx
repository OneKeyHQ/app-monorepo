import type { ReactNode } from 'react';
import { memo, useState } from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ITabDeveloperParamList } from '@onekeyhq/shared/src/routes';
import { ETabDeveloperRoutes } from '@onekeyhq/shared/src/routes';
import { EAppSettingKey } from '@onekeyhq/shared/src/storage/appSetting';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import useCookie from '../../../hooks/useCookie';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { StartTimePanel } from '../../Setting/pages/List/DevSettingsSection/StartTimePanel';

const useStorage = platformEnv.isNative
  ? (key: EAppSettingKey, initialValue?: boolean) => {
      const [data, setData] = useState(
        initialValue || appStorage.getSettingBoolean(key),
      );
      const setNewData = (value: boolean) => {
        appStorage.setSetting(key, value);
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

function StartTimePanelContainer() {
  return (
    <PartContainer title="Startup Time(ms)">
      <StartTimePanel />
    </PartContainer>
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
  const [rrtStatus, changeRRTStatus] = useStorage(EAppSettingKey.rrt);

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
                    window.location.reload();
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
            </PartContainer>

            <PartContainer title="Commit Hash">
              <SizableText>{process.env.COMMITHASH}</SizableText>
            </PartContainer>

            <PartContainer title="Commit Hash">
              <Button
                onPress={async () => {
                  const { test } = await import('./asyncImportTest');
                  test();
                }}
              >
                Async Import Test
              </Button>
            </PartContainer>
            <StartTimePanelContainer />
            <ConnectWalletConnectDapp />
            <TestRefresh />
            {/* <WalletConnectModalNative2 /> */}
          </ScrollView>
        </Page.Body>
      </Page>
    </AccountSelectorProviderMirror>
  );
};

export default TabDeveloper;

import { useCallback } from 'react';

import { Button, Dialog, Page, Text, Toast } from '@onekeyhq/components';
import { EPasswordResStatus } from '@onekeyhq/kit-bg/src/services/ServicePassword/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  AccountSelectorActiveAccount,
  AccountSelectorProvider,
  AccountSelectorProviderMirror,
  AccountSelectorTrigger,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';
import { CreateHdWalletForm } from '../../../components/AccountSelector/CreateHdWalletForm';
import { DeriveTypeSelectorTrigger } from '../../../components/AccountSelector/DeriveTypeSelectorTrigger';
import { NetworkSelectorTrigger } from '../../../components/AccountSelector/NetworkSelectorTrigger';
import PasswordSetupContainer from '../../../components/Password/container/PasswordSetupContainer';

const handlePasswordVerify = async () => {
  try {
    const { status, password } =
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
    if (status === EPasswordResStatus.PASS_STATUS) {
      Toast.success({ title: '验证成功' });
    }
  } catch (e: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const errorMessage = e?.message;
    if (errorMessage) {
      Toast.error({ title: errorMessage });
    }
  }
};

function HomePage() {
  const headerTitle = useCallback(
    () => (
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
        }}
      >
        <AccountSelectorTriggerHome num={0} />
      </AccountSelectorProviderMirror>
    ),
    [],
  );
  return (
    <Page>
      <Page.Header headerTitle={headerTitle} />
      <Page.Body alignItems="center">
        <Text>Hello Onekey</Text>

        <NetworkSelectorTrigger num={0} />
        <DeriveTypeSelectorTrigger num={0} />
        <AccountSelectorActiveAccount num={0} />
        <CreateHdWalletForm />
        <Button
          onPress={async () => {
            const checkPasswordSet =
              await backgroundApiProxy.servicePassword.isPasswordSet();
            if (checkPasswordSet) {
              await handlePasswordVerify();
            } else {
              const dialog = Dialog.show({
                title: 'SetupPassword',
                renderContent: (
                  <PasswordSetupContainer
                    onSetupRes={(data) => {
                      console.log('setup data', data);
                      if (data) {
                        Toast.success({ title: '设置成功' });
                        void dialog.close();
                      }
                    }}
                  />
                ),
                showFooter: false,
              });
            }
            // setOpen(!open);
          }}
        >
          密码设置弹窗
        </Button>
        <AccountSelectorTrigger onlyAccountSelector num={0} />
      </Page.Body>
    </Page>
  );
}

function HomePageContainer() {
  return (
    <AccountSelectorProvider
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomePage />
    </AccountSelectorProvider>
  );
}

export default HomePageContainer;

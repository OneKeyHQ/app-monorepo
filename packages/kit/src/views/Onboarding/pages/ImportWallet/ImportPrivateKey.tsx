import { Form, Input, Page, useForm, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ControlledNetworkSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { WALLET_TYPE_IMPORTED } from '@onekeyhq/shared/src/consts/dbConsts';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Tutorials } from '../../components';

export function ImportPrivateKey() {
  const media = useMedia();
  const form = useForm();
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();

  return (
    <Page>
      <Page.Header title="Import Private Key" />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field label="Network" name="networkId">
            <ControlledNetworkSelectorTrigger />
          </Form.Field>
          <Form.Field label="Private Key" name="input">
            <Input
              secureTextEntry
              placeholder="Enter your private key"
              size={media.gtMd ? 'medium' : 'large'}
              testID="private-key"
              addOns={[
                {
                  iconName: 'ScanOutline',
                  onPress: () => console.log('scan'),
                },
              ]}
            />
          </Form.Field>
        </Form>
        <Tutorials
          list={[
            {
              title: 'What is a private key?',
              description:
                'A combination of letters and numbers that is utilized to manage your assets.',
            },
            {
              title: 'Is it safe to enter it into OneKey?',
              description:
                'Yes. It will be stored locally and never leave your device without your explicit permission.',
            },
          ]}
        />
      </Page.Body>
      <Page.Footer
        onConfirm={async () => {
          const values = form.getValues();
          const r = await backgroundApiProxy.serviceAccount.addImportedAccount({
            input: await backgroundApiProxy.servicePassword.encodeSensitiveText(
              {
                text: values.input,
              },
            ),
            networkId: values.networkId,
          });
          console.log(r, values);

          void actions.current.updateSelectedAccount({
            num: 0,
            builder: (v) => ({
              ...v,
              networkId: values.networkId,
              focusedWallet: '$$others',
              walletId: WALLET_TYPE_IMPORTED,
              othersWalletAccountId: r.accounts[0].id,
              indexedAccountId: undefined,
            }),
          });
          navigation.popStack();
        }}
      />
    </Page>
  );
}

function ImportPrivateKeyPage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <ImportPrivateKey />
    </AccountSelectorProviderMirror>
  );
}

export default ImportPrivateKeyPage;
